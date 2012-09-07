# Quicktime/MP4 Fast Start

Enable streaming and pseudo-streaming of Quicktime and MP4 files by
moving metadata and offset information to the front of the file.

The implementation is a plug in replacement for `fs.createReadStream()`
and works behind the scene to expose the input file as a fast start
enabled stream.

## TODO ##

* More documentation.
* Test case(s) for 64-bit.
* Resize-OK option (strip `free` atoms and convert to 64-bit when required).
* Pre-calculate output size.
* Support any _valid_ file by converting `stco` to `co64` when required.
* Command-line interface?

# License
Copyright (C) 2012  Gil Pedersen <gpdev@gpost.dk>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.