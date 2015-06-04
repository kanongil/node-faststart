# Quicktime/MP4 Fast Start for node.js

Enable streaming and pseudo-streaming of Quicktime and MP4 files by moving metadata and offset information to the front of the file.

The implementation is a plug-in replacement for `fs.createReadStream()` and works behind the scene to expose the input file as a fast start enabled stream.

## Usage

    var faststart = require('faststart);
    
    faststart.createReadStream('movie.mp4').pipe(…);

## Methods

### faststart.createReadStream(path, [options])

Returns a standard readable file stream.

#### Extra options

* `passthrough` - Boolean. Set to detect non-movie files and don't try to "fix" them.

## Install

    npm install faststart

## TODO ##

* More documentation.
* Test case(s) for 64-bit.
* Resize-OK option (strip `free` atoms and convert to 64-bit when required).
* Pre-calculate output size.
* Support any _valid_ file by converting `stco` to `co64` when required.
* Command-line interface?

# License
(BSD 2-Clause License)

Copyright (c) 2013-2015, Gil Pedersen &lt;gpdev@gpost.dk&gt;
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met: 

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer. 
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution. 

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
