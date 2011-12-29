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


## December 2011

This might grow into something more useful, but at the moment is where
I put the code I reuse to do this kind of thing. It may therefore be
rather untested and unstable. I am making it publically available just
because there's no point in keeping it secret.

