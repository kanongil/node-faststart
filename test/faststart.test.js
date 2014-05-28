var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    stream = require('stream'),
    crypto = require("crypto"),
    assert = require("assert"),
    faststart = require('../faststart');

var fixtureDir = path.join(__dirname, 'fixtures');

describe('FSStream', function() {

  it('should inherit from stream.Stream', function(done) {
  	var fsstream = faststart.createReadStream('/dev/null');
    assert.ok(fsstream instanceof stream.Stream);
    fsstream.on('close', done).on('error', done).destroy();
  })

  it('should emit "open" with Number "fd"', function(done) {
    var fsstream = faststart.createReadStream('/dev/null');
    fsstream.on('open', function(fd) {
      assert.equal('number', typeof fd);
      assert.ok(fsstream.readable);

      fsstream.on('close', done).on('error', done).destroy();
    })
  })
  
  suite('lena.mp4', 11504, '4b1be4244abb54e4e5ef1b8d48f2ef0ab1a27d73')
  suite('lena-faststart.mp4', 11504, '4b1be4244abb54e4e5ef1b8d48f2ef0ab1a27d73')
  suite('lena.jp2', 26686, 'd147fc89dc57b36df994ed737b973e4cd86d6509')
})

function suite(file, size, shasum) {
  describe('path='+file, function() {
    var fsstream;
  
    beforeEach(function() {
      fsstream = faststart.createReadStream(path.join(fixtureDir, file), {passthrough: true});
    })
    
    afterEach(function() {
      fsstream.destroy();
    })
  
    it('should produce correct output', function(done) {
      var hash = crypto.createHash('sha1');

      var fsize = 0;
      fsstream.on('data', function(chunk) {
        hash.update(chunk);
        fsize += chunk.length;
      })
      .on('end', function() {
        assert.equal(size, fsize, 'incorrect file size ('+fsize+'!='+size+')');
        assert.equal(hash.digest('hex'), shasum);
        done();
      });
    })

    describe('#pipe()', function() {
      it('should "end"', function(done) {
        fsstream.pipe(fs.createWriteStream('/dev/null'));
        fsstream.on('end', function() {
        	done();
        });
      })
      it('should "close"', function(done) {
        fsstream.pipe(fs.createWriteStream('/dev/null'));
        fsstream.on('close', function() {
        	done();
        });
      })
      it('should "close" write-end', function(done) {
        fsstream.pipe(fs.createWriteStream('/dev/null')).on('close', function() {
        	done();
        });
      })
      it('should work with late event subscriptions', function(done) {
        fsstream.pipe(fs.createWriteStream('/dev/null'));
        fsstream.once('data', function(chunk) {
          fsstream.on('end', function() {
            fsstream.on('close', function() {
              done();
            });
          });
        });
      })
    })
  })
}
