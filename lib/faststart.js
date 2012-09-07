// Logic based on http://github.com/danielgtaylor/qtfaststart/blob/master/qtfaststart/processor.py
// Implementation based on ReadStream http://github.com/joyent/node/blob/master/lib/fs.js
// Format info http://xhelmboyx.tripod.com/formats/mp4-layout.txt

var fs = require('fs'),
    util = require('util'),
    async = require('async'),
    assert = require('assert');

var debug;
if (process.env.FASTSTART_DEBUG) {
  debug = function(x) { console.error('FASTSTART: %s', x); };
} else {
  debug = function() { };
}

var faststart = exports;
var Stream = require('stream').Stream;

var MAX_UINT32 = Math.pow(2, 32)-1;
// Due to platform limitations 64-bit values can't have more than 52 bits of data
var MAX_UINT64 = Math.pow(2, 52)-1;

function read_atom_header(fd, offset, callback) {
  var buffer = new Buffer(16);
  
  fs.read(fd, buffer, 0, 16, offset, function(err, bytesRead, buf) {
    if (err) return callback(err);
    if (bytesRead < 8) return callback();

    var size = buf.readUInt32BE(0, true);
    var type = buf.toString('ascii', 4, 8);
    var skip = 8;
    if (size === 1 && bytesRead == 16) { // 64-bit size
      size = buf.readUInt32BE(8, true)*Math.pow(2, 32) + buf.readUInt32BE(12, true);
      assert.ok(size <= MAX_UINT64, 'Size too large to calculate');
      skip = 16;
    }

    callback(null, {type: type, offset: offset, size: size, skip: skip});
  });
};

function get_index(fd, callback) {
  var index = [];
  var moov, mdat;

  read_atom_header(fd, 0, function check(err, atom) {
  	if (err) return callback(err);
  	if (!atom) return callback(null, index, moov, mdat);
  	
  	if (atom.offset === 0 && atom.type !== 'ftyp')
      return callback(new ParseError('Unknown/Unsupported file type.'));

    if (atom.type === 'moov') {
      if (moov) return callback(new ParseError('Multiple "moov" fragments.'));
      moov = index.length;
    }
    if (atom.type === 'mdat') {
      if (mdat) return callback(new ParseError('Multiple "mdat" fragments.'));
      mdat = index.length;
    }
    
    // mdat atoms are allowed to have 0 size if they are at the end
    if (atom.size === 0 && atom.type === 'mdat') {
      // calculate the actual size
      fs.fstat(fd, function(err, stats) {
        if (err) return callback(err);
        atom.size = stats.size - atom.offset;
        index.push(atom);
        return callback(err, index, moov, mdat); // We're done
      });
    }

    if (atom.size < 8) // ensure we don't end in an infinite loop
      return callback(new ParseError('Invalid atom size (less than 8 bytes).'));

    // TODO: limit index size?

    index.push(atom);

    read_atom_header(fd, atom.offset + atom.size, check);
  });
}

function mirror_events(events, src, dst) {
  events.forEach(function(event) {
    src.listeners(event).forEach(function(listener) {
      dst.addListener(event, listener);
    });
  });
  
  src.on('newListener', function(event, listener) {
  	if (events.indexOf(event) !== -1)
      dst.addListener(event, listener);
  });
  
  var srcRemoveListener = src.removeListener;
  src.removeListener = function(type, listener) {
    srcRemoveListener.apply(src, arguments);
    if (events.indexOf(type) !== -1) {
      dst.removeListener.apply(dst, arguments);
  	}
  }
}

faststart.createReadStream = function(path, options) {
  return new FSStream(path, options);
};

var FSStream = faststart.FSStream = function(path, options) {
  if (!(this instanceof FSStream)) return new FSStream(path, options);

  Stream.call(this);

  var self = this;

  this.path = path;
  this.fd = null;
  this.readable = true;
  this.paused = false;

  this.flags = 'r';
  this.mode = 438; /*=0666*/
  this.bufferSize = 64 * 1024;
  
  // FSStream specific options
  this.passthrough = false; // passthrough any file

  options = options || {};

  // Mixin options into this
  var keys = Object.keys(options);
  for (var index = 0, length = keys.length; index < length; index++) {
    var key = keys[index];
    this[key] = options[key];
  }

  // FIXME: how should encoding be handled?
  if (this.encoding) this.setEncoding(this.encoding);

  this.offset = 0;

//    this.encoding = 'binary';

  function clone_stream(start, end) {
    self._stream = fs.createReadStream(self._path, {
      fd: self.fd, mode: self.mode, bufferSize: self.bufferSize,
      start: start, end: end
    });
    mirror_events(['data', 'close'], self, self._stream);
    self._stream.on('end', function() {
      self.emit('end');
      self.destroy();
    });
    self._stream.on('error', self._emitError);
    
    if (self.paused) self.pause();
    if (self._pipedst) self.pipe(self._pipedst, self._pipeopts);
  }

  fs.open(this.path, 'r', function(err, fd) {
    if (err) return self._emitError(err);
  	
  	self.fd = fd;
  	self.emit('open', fd);
  	
  	get_index(fd, function(err, index, moov, mdat) {
  	  if (!self.readable) return;
      if (err && !(self.passthrough && err instanceof ParseError))
        return self._emitError(err);
      if (index && (!moov || !mdat))
        return self._emitError(new ParseError('Missing moov/mdat atom.'));

      if (!index) {
      	debug('Passthrough');
        clone_stream();
      } else if (index[moov].offset < index[mdat].offset) {
      	debug('File is already fast start');
        clone_stream();
      } else {
        // re-arrange index
        var new_index = [index[0]];
        new_index = new_index.concat(index.slice(moov)); // moov + any extra
        var stream_index = index.slice(1, moov); // mdat + remaining

        var first = new_index[1]
        var last = new_index.slice(-1)[0];
        self.offset = (last.offset + last.size) - first.offset;

        process.nextTick(function() {
          async.forEachSeries(new_index, function(atom, next) {
            self._read(atom, next);
          }, function(err) {
            if (err) return self._emitError(err);

            var first = stream_index[0]
            var last = stream_index.slice(-1)[0];
            clone_stream(first.offset, last.offset + last.size - 1);
          });
        });
      }
  	});
  });
}
util.inherits(FSStream, Stream);

// Helper functions
FSStream.prototype._emitError = function(err) {
  this.emit('error', err);
  this.readable = false;
}

FSStream.prototype._read = function(base_atom, callback) {
  var self = this;
  
  var end = base_atom.offset + base_atom.size;
  
  var process_atoms = ['moov', 'trak', 'mdia', 'minf', 'stbl'];
  if (process_atoms.indexOf(base_atom.type) === -1) {
    var buffer = new Buffer(base_atom.size);
    fs.read(self.fd, buffer, 0, base_atom.size, base_atom.offset, function(err, bytesRead, buf) {
      if (err) return callback(err);
      
      if (self.offset) {
        if (base_atom.type === 'stco') {
          var count = buf.readUInt32BE(12, true);
  
          for (var i=0, pos=16; i<count; i++, pos+=4) {
            var offset = buf.readUInt32BE(pos, true)+self.offset;
            if (offset > MAX_UINT32)
              return callback(new Error('Bad input file: "stco" atom found, but "co64" is required for fast start.'));
            buf.writeUInt32BE(offset, pos, true);
          }
        } else if (base_atom.type === 'co64') {
          var count = buf.readUInt32BE(12, true);
          for (var i=0, pos=16; i<count; i++, pos+=8) {
            // 64-bit 2's-complement math (with assumptions for speed)
            var hi = buf.readUInt32BE(pos, true);
            var lo = buf.readUInt32BE(pos+4, true) + self.offset;
            while (lo > MAX_UINT32) {
              lo -= MAX_UINT32+1;
              hi += 1;
            }
            buf.writeUInt32BE(hi, pos, true);
            buf.writeUInt32BE(low, pos+4, true);
          }
        }
      }
      
      self.emit('data', buf);
      callback(null);
    });
    return;
  }
  
  // emit container atom header
  var buf = new Buffer(base_atom.skip);
  if (base_atom.skip == 16) {
    buf.writeUInt32BE(1, 0, true);
    buf.writeUInt32BE(base_atom.size>>32, 8, true);
    buf.writeUInt32BE(base_atom.size, 12, true);
  } else {
    buf.writeUInt32BE(base_atom.size, 0, true);
  }
  buf.write(base_atom.type, 4, 4, 'ascii');
  self.emit('data', buf);

  // read and parse sub-atoms
  read_atom_header(self.fd, base_atom.offset+base_atom.skip, function handle_atom(err, atom) {
  	if (err || !atom) return callback(err);

    var atom_end = atom.offset + atom.size;
    if (atom_end > end)
      return callback(new ParseError('Invalid atom structure.'));
    
    if (atom.size < 8) // ensure we don't end in an infinite loop
      return callback(new ParseError('Invalid atom size (less than 8 bytes).'));

    self._read(atom, function(err) {
      if (err) return callback(err);
      
      if (atom_end === end)
        return callback();
      
      read_atom_header(self.fd, atom_end, handle_atom);
    });
  });
}

// Stream API http://nodejs.org/api/stream.html
FSStream.prototype.pause = function() {
  this.paused = true;
  if (this._stream) this._stream.pause.apply(this._stream, arguments);
}
FSStream.prototype.resume = function() {
  this.paused = false;
  if (this._stream) this._stream.resume.apply(this._stream, arguments);
}
FSStream.prototype.destroy = function(cb) {
  var self = this;
  
  if (!this.readable) {
    if (cb) process.nextTick(function() { cb(null); });
    return;
  }
  this.readable = false;
  
  if (this._stream) return this._stream.destroy.apply(this._stream, arguments);

  function close() {
    fs.close(self.fd, function(err) {
      if (err) {
        if (cb) cb(err);
        self.emit('error', err);
        return;
      }

      if (cb) cb(null);
      self.emit('close');
    });
  }
  
  if (this.fd === null) {
    this.addListener('open', close);
  } else {
    close();
  }
}
// FIXME: is there really any point in overriding the pipe implementation?
/*FSStream.prototype.pipe = function(dest, opts) {
  if (this._stream) return Stream.prototype.pipe.call(this._stream, dest, opts)
  
  // FIXME: should we close this if we never make a stream?
  this._pipedst = dest;
  this._pipeopts = opts;
  
  return dest;
}*/

var ParseError = faststart.ParseError = function(msg, constr) {
  Error.captureStackTrace(this, constr || this)
  this.message = msg || 'Error'
}
util.inherits(ParseError, Error)
ParseError.prototype.name = 'Parser Error'
