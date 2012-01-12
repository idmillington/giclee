(function($) {
    // Import
    var ObjectBase = gce.utils.ObjectBase;

    var aabbCreate = gce.datatypes.aabbCreate;

    var posCreate = gce.datatypes.posCreate;
    var posCopy = gce.datatypes.posCopy;
    var posConcat = gce.datatypes.posConcat;
    var posInvert = gce.datatypes.posInvert;
    var posTransform = gce.datatypes.posTransform;
    var posSetTransform = gce.datatypes.posSetTransform;

    var DragManager = gce.managers.DragManager;

    // ----------------------------------------------------------------------
    // Platform dependency shims
    // ----------------------------------------------------------------------

    /**
     * Animation can be synched to the platform refresh rate, but in a
     * platform-dependent way.
     */
    (function() {
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = (
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function(callback) {
                    window.setTimeout(callback, 1000 / 60);
                }
            );
        }
    })();

    /**
     * Test for and correct Mozilla's PointInPath bug (credit:
     * stackoverflow).
     */
    (function() {
        // Create a temporary canvas.
        var c = document.createElement("canvas").getContext("2d");
        c.translate(50, 0);
        c.moveTo(125, 50);
        c.arc(100, 50, 25, 0, 360, false);
        if (!c.isPointInPath(150, 50))
        {
            // Replace the method with a new wrapper.
            var proto = CanvasRenderingContext2D.prototype;
            var original = proto.isPointInPath;
            proto.isPointInPath = function(x, y) {
                this.save();
                this.setTransform(1,0, 0,1, 0,0);
                var result = original.call(this, x, y);
                this.restore();
                return result;
            };
        };
    })();

    // --------------------------------------------------------------------
    // Renderers are used to display objects.
    // --------------------------------------------------------------------
    var Renderer = ObjectBase.extend();

    /**
     * Creates a renderer for the given element. If any recursively
     * nested elements also need their own renderers, then the given
     * getRenderer function can be called to provide them.
     */
    Renderer.init = function(parent, element, getRenderer) {
        this.parent = parent;
        this.element = element;
    };

    /**
     * Renders this object to the given context. This is normally not
     * overridden, since it provides top level support for things like
     * in-bounds detection, Position-Orientation-Scale and
     * filters. Instead, override the renderLocalCoords function.
     */
    Renderer.renderGlobalCoords = function(c, posStack, globalBounds) {
        var pos = this.element.pos;
        pos = posConcat(posStack[0], pos);

        // TODO: Calculate the local bounds from the transform and
        // global bounds.
        var localBounds = undefined;

        // Set the transform.
        c.save();
        posStack.unshift(pos);
        posSetTransform(pos, c);

        // Draw the object.
        this.renderLocalCoords(c, posStack, localBounds);

        // Remove the transform.
        posStack.shift();
        c.restore();

        // TODO: Handle filters.
    };

    /**
     * Override this function to do the actual rendering for this
     * object.
     */
    Renderer.renderLocalCoords = function(c, posStack, localBounds) {
        c.fillRect(-50, -50, 100, 100);
    };

    /**
     * Returns true if the given global point is inside this
     * object. Objects can decide whether to be transparent to clicks,
     * or can use click areas that are different from their rendering
     * envelope. By default this method performs global to local
     * transform on the given point, then calls
     * isLocalPointInObject. In most cases, however, there are
     * better ways to calculate the same thing.
     */
    Renderer.isGlobalPointInObject = function(c, posStack, globalPoint) {
        var pos = this.element.pos;
        pos = posConcat(posStack[0], pos);

        // Calculate the local point.
        var globalToLocal = posInvert(pos);
        var localPoint = posTransform(globalToLocal, globalPoint);

        // Calculate the result.
        posStack.unshift(pos);
        var result = this.isLocalPointInObject(c, posStack, localPoint);
        posStack.shift();
        return result;
    };

    /**
     * Should return true if the given point (in object coordinates)
     * is in this object. This should be overridden, unless the global
     * version is overridden.
     */
    Renderer.isLocalPointInObject = function(c, posStack, localPoint) {
        var x = localPoint.x, y = localPoint.y;
        return x > -50 && x < 50 && y > -50 && y < 50;;
    };

    // --------------------------------------------------------------------
    // The viewer displays a document on a canvas.
    // --------------------------------------------------------------------

    var Viewer = ObjectBase.extend();

    /**
     * Creates a new viewer to connect the given canvas to the given
     * document.
     *
     * The given list of renderers are used to turn objects in the
     * document into a visual representation. They should be derived
     * from the Renderer object.
     */
    Viewer.init = function($canvas, document, renderers) {
        this.$canvas = $canvas
        this.canvas = $canvas.get(0);
        this.c = this.canvas.getContext("2d");

        this.pos = posCreate();
        this.document = document;

        this._initRenderers(renderers);
        this._initEvents();

        this.draw();
    };

    /**
     * Initializes events.
     */
    Viewer._initEvents = function() {
        var that = this;
        this.$canvas.mousedown(function(event) {
            var w = that.$canvas.width(), h = that.$canvas.height();

            var dm = DragManager.create();
            dm.setPos(that.pos, {x:w*0.5, y:h*0.5}, false);
            dm.setLocks(false, true, false);
            dm.setRotateScaleOverride(event.shiftKey);
            dm.startTouch(1, {x:event.offsetX, y:event.offsetY});

            var move = function(event) {
                dm.setRotateScaleOverride(event.shiftKey);
                dm.moveTouch(1, {x:event.offsetX, y:event.offsetY});

                that.pos = posCopy(dm.pos);
                that.draw();
            };

            var up = function(event) {
                dm.endTouch(1, {x:event.offsetX, y:event.offsetY});

                that.$canvas.unbind('mousemove', move);
                that.$canvas.unbind('mouseup', up);
            };

            that.$canvas.bind('mousemove', move);
            that.$canvas.bind('mouseup', up);
        });
    };

    /**
     * Initializes the renderer lookup.
     */
    Viewer._initRenderers = function(renderers) {
        /*
         * Create a local function that can retrieve a valid renderer
         * for the given element. This needs to be a local function
         * (rather than declaring a Viewer.getRenderer function)
         * because we need to pass it to renderers, with lexical
         * scoping intact, so they can created nested elements.
         */
        var that = this;
        var getRenderer = function(element) {
            // Try to find a cached renderer.
            var renderer = element["-renderer"];
            if (renderer === undefined) {

                // Otherwise find the approprate type.
                var RendererType = that.renderers[element.type];
                if (RendererType === undefined) {
                    RendererType = that.renderers["$default"];
                }

                // Instantiate it.
                renderer = RendererType.create(that, element, getRenderer);

                // Cache it.
                element["-renderer"] = renderer;
            }

            return renderer;
        };

        // Store the renderers and the function.
        this.renderers = renderers || {"$default":Renderer};
        this.getRenderer = getRenderer;
    };

    /**
     * Returns the POS of the main view, which is based on the
     * internal POS field, and the dimensions of the canvas, such that
     * the position in that POS field appears at the center of the canvas.
     */
    Viewer.getViewPos = function() {
        var pos = this.pos;
        var w = this.$canvas.width(), h = this.$canvas.height();
        return {x:w*0.5+pos.x, y:h*0.5+pos.y, o:pos.o, s:pos.s};
    };

    /**
     * Performs a complete redraw of the canvas.
     */
    Viewer.draw = function() {
        var c = this.c;
        var w = this.$canvas.width(), h = this.$canvas.height();

        c.setTransform(1, 0, 0, 1, 0, 0);
        this.redraw(0, 0, w, h);
    };

    /**
     * Redraws the given part of the canvas.
     */
    Viewer.redraw = function(x, y, w, h) {
        var c = this.c;
        c.clearRect(x, y, w, h);

        var posStack = [this.getViewPos()];
        var aabb = aabbCreate(x, y, w, h);

        var content = this.document.content;
        for (var i = 0; i < content.length; i++) {
            var element = content[i];
            var renderer = this.getRenderer(element);
            renderer.renderGlobalCoords(c, posStack, aabb);
        }
    };

    /**
     * Returns the renderers of the objects at the given global
     * coordinates.
     */
    Viewer.getRenderersAt = function(xy) {
        var posStack = [this.getViewPos()];
        var c = this.c;

        var result = [];
        var content = this.document.content;
        for (var i = 0; i < content.length; i++) {
            var element = content[i];
            var renderer = this.getRenderer(element);
            if (renderer.isGlobalPointInObject(c, posStack, xy)) {
                result.push(renderer);
            };
        }
        return result;
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.gce === undefined) window.gce = {};
    window.gce.viewer = {
        Viewer: Viewer
    };

})(jQuery);