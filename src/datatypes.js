(function() {
    /*
     * This module contains some data types used in the rest of the
     * system. They are not implemented as a derived type, because
     * they are commonly used in JSON data, and so need to be raw
     * objects. Instead they are 'object oriented' by virtue of the
     * sets of functions which manipulate them, namespaced by the
     * datatype. This approach is common in object-oriented C
     * programs.
     */

    // ----------------------------------------------------------------------
    // Transforms
    // ----------------------------------------------------------------------

    /*
     * Position/Orientation/Scale (POS) are objects containing x, y,
     * o, s fields. They represent isotropic transformations in 2d
     * space. The orientation is given in radians. The translation is
     * considered to be applied before orientation and scale (because
     * scale is isotropic, the order of scale+orientation is
     * irrelevant).
     */

    /**
     * Returns a new identity POS.
     */
    var posCreate = function(x, y, o, s) {
        return {
            x:(x!==undefined)?x:0,
            y:(y!==undefined)?y:0,
            o:(o!==undefined)?o:0,
            s:(s!==undefined)?s:1
        };
    };

    /**
     * Returns a new copy of the given pos.
     */
    var posCopy = function(pos) {
        return {x:pos.x, y:pos.y, o:pos.o, s:pos.s};
    };

    /**
     * Returns a new POS which represents the combination of the two
     * given transforms.
     */
    var posConcat = function(pos1, pos2) {
        if (pos1 === undefined) return pos2;
        var cos = pos1.s * Math.cos(pos1.o);
        var sin = pos1.s * Math.sin(pos1.o);
        return {
            x: pos1.x + pos2.x*cos - pos2.y*sin,
            y: pos1.y + pos2.x*sin + pos2.y*cos,
            o: pos1.o + pos2.o,
            s: pos1.s * pos2.s
        };
    };

    /**
     * Returns a POS which is the inverse of the given POS.
     */
    var posInvert = function(pos) {
        var cos = Math.cos(pos.o)/pos.s;
        var sin = Math.sin(pos.o)/pos.s;
        return {
            x: -cos*pos.x - sin*pos.y,
            y: sin*pos.x - cos*pos.y,
            o: -pos.o,
            s: 1.0 / pos.s
        };
    };

    /**
     * Returns the given x,y position transformed by the given POS.
     */
    var posTransform = function(pos, xy) {
        var cos = pos.s*Math.cos(pos.o);
        var sin = pos.s*Math.sin(pos.o);
        return {
            x: cos*xy.x - sin*xy.y + pos.x,
            y: sin*xy.x + cos*xy.y + pos.y
        };
    };

    /**
     * Sets the 2d affine transform matrix for the given POS into the
     * given canvas context.
     */
    var posSetTransform = function(pos, c) {
        var cos = pos.s*Math.cos(pos.o);
        var sin = pos.s*Math.sin(pos.o);
        c.setTransform(cos, sin, -sin, cos, pos.x, pos.y);
    };

    /**
     * Creates a pos which represents a transform where the given two
     * points are moved between their original and current locations,
     * so posTransform(pos, original1) = current1, and
     * posTransform(pos, original2) = current2.
     */
    var posFromPoints = function(original1, original2, current1, current2,
                                 lockPosition, lockOrientation, lockScale) {
        var pos = {x:0, y:0, o:0, s:1};

        // Calculate offsets
        var originalOffset = {
            x: original2.x - original1.x, y: original2.y - original1.y
        };
        var originalDistance = Math.sqrt(originalOffset.y*originalOffset.y+
                                         originalOffset.x*originalOffset.x);
        if (originalDistance === 0) {
            throw "The two original points must not be the same.";
        }
        var currentOffset = {
            x: current2.x - current1.x, y: current2.y - current1.y
        };

        // Find the change in orientation and scale.
        if (!lockOrientation) {
            var originalTheta = Math.atan2(originalOffset.y, originalOffset.x);
            var currentTheta = Math.atan2(currentOffset.y, currentOffset.x);
            var deltaO = currentTheta - originalTheta;
            while (deltaO < -Math.PI) deltaO += Math.PI;
            while (deltaO > Math.PI) deltaO -= Math.PI;
            pos.o = deltaO;
        }

        if (!lockScale) {
            var currentDistance = Math.sqrt(currentOffset.y*currentOffset.y+
                                            currentOffset.x*currentOffset.x);
            pos.s = currentDistance / originalDistance;
        }

        // Calculate the change in position
        if (!lockPosition) {
            // Correct for the offset from 0,0
            var cos = pos.s*Math.cos(pos.o);
            var sin = pos.s*Math.sin(pos.o);
            pos.x = current1.x - (cos*original1.x - sin*original1.y);
            pos.y = current1.y - (sin*original1.x + cos*original1.y);
        }

        return pos;
    };

    // ----------------------------------------------------------------------
    // AABBs
    // ----------------------------------------------------------------------

    /*
     * Axis-Aligned Bounding Boxes (AABB) are objects with an x, y, w,
     * h, coordinates.
     */

    /**
     * Creates a new AABB.
     */
    var aabbCreate = function(x, y, w, h) {
        return {
            x:(x!==undefined)?x:0,
            y:(y!==undefined)?y:0,
            w:(w!==undefined)?w:0,
            h:(h!==undefined)?h:0
        };
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.gce === undefined) window.gce = {};
    window.gce.datatypes = {
        posCreate: posCreate,
        posCopy: posCopy,
        posConcat: posConcat,
        posInvert: posInvert,
        posTransform: posTransform,
        posSetTransform: posSetTransform,
        posFromPoints: posFromPoints,

        aabbCreate: aabbCreate
    };

})();