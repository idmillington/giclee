# Generic Canvas Editor

This is an object-based canvas editing system designed for both
desktop and multi-touch use. It also contains a bunch of useful
utilities for general canvas work, such as an image manager and
drag/gesture interpretations.

To build, do

    make

You will need uglify-js and less to do this. They are both based on
node.js, and can be retrieved using the node package manager:

    npm install uglify-js less

Do this in the top level directory, so it creates the `node_modules`
directory where the Makefile expects it to be.


## Linting

I try to make sure the codebase is lint-validated without warnings, to
the extent this is possible. To do this do

    make lint

This uses JSHint, which you'll need to install with node:

     npm install jshint

(despite the warning you get, it seems fine to install this locally).


## Test

There is a (currently woefully under-comprehensive) test suite. To
access it, go to the `test` directory and do:

      ./run.sh

to run the webserver, then go to `http://localhost:8081`.

The webserver just uses python's built-in minimal webserver. If you
are alergic to python, you can do the same with other tools. Ruby, for
example:

    $ ruby -rwebrick -e'WEBrick::HTTPServer.new(:Port => 8081, :DocumentRoot => Dir.pwd).start'


## Samples

Go into the `samples` directory and run the server:

   ./run.sh

then go to `http://localhost:8000` and browse the samples. Then browse
the accompanying code. Again the files are served with python's
minimal webserver, but similarly you can serve it in another way.


## Project Status: April 2011

This might grow into something more useful, but at the moment is where
I put the code I reuse to do this kind of thing. It may therefore be
rather untested and unstable. I am filling it out *very* slowly. I am
making it publically available just because there's no point in
keeping it secret.

