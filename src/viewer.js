(function($) {
    // Import
    var ObjectBase = giclee.utils.ObjectBase;

    var ModelFactory = giclee.model.ModelFactory;

    var AABB = giclee.datatypes.AABB;

    var posCreate = giclee.datatypes.posCreate;
    var posClone = giclee.datatypes.posClone;
    var posConcat = giclee.datatypes.posConcat;
    var posInvert = giclee.datatypes.posInvert;
    var posTransform = giclee.datatypes.posTransform;
    var posSetTransform = giclee.datatypes.posSetTransform;

    var DragManager = giclee.managers.DragManager;

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
     * Test for and correct Mozilla's PointInPath bug (see
     * https://bugzilla.mozilla.org/show_bug.cgi?id=405300 for bug and
     * solution).
     */
    (function() {
        // Create a temporary canvas.
        var c = document.createElement("canvas").getContext("2d");
        c.translate(50, 0);
        c.moveTo(125, 50);
        c.arc(100, 50, 25, 0, 360, false);
        if (!c.isPointInPath(150, 50)) {
            // Replace the method with a new wrapper that transforms
            // the context before doing the test.
            var proto = CanvasRenderingContext2D.prototype;
            var original = proto.isPointInPath;
            proto.isPointInPath = function(x, y) {
                this.save();
                this.setTransform(1,0, 0,1, 0,0);
                var result = original.call(this, x, y);
                this.restore();
                return result;
            };
        }
    })();

    /**
     * Test and patch the jquery event handler to add offsetX and
     * offsetY on platforms that don't have it (see
     * http://bugs.jquery.com/ticket/8523 for bug and solution).
     */
    (function() {
        // Wrap the default filter with code to additionally set
        // offsetX/Y. NB: $.event.mouseHooks.filter is a
        // non-documented API for jQuery, so this may need to be
        // changed with new versions!
        var filter = $.event.mouseHooks.filter;
        $.event.mouseHooks.filter = function(event, original) {
            event = filter(event, original);
            if (typeof event.offsetX === "undefined" ||
                typeof event.offsetY === "undefined") {
                var targetOffset = $(event.target).offset();
                event.offsetX = event.pageX - targetOffset.left;
                event.offsetY = event.pageY - targetOffset.top;
            }
            return event;
        };
    })();

    // --------------------------------------------------------------------
    // A display displays a document on a canvas. It is the base of other
    // display elements (notably the viewer), but does not allow any
    // interaction.
    // --------------------------------------------------------------------

    var Display = ObjectBase.extend();

    /**
     * Default options. Overriding this in subtypes is a little
     * tricky, see Viewer._defaultOptions for details.
     */
    Display._defaultOptions = {
        ModelFactory: ModelFactory.getGlobal(),
        initPos: true,
        initPosScale: 1000.0
    };

    /**
     * Creates a new display to connect the given canvas to the given
     * document.
     *
     * The given list of renderers are used to turn objects in the
     * document into a visual representation. They should be derived
     * from the Renderer object.
     */
    Display.init = function($canvas, document, options) {
        this.events = giclee.managers.EventManager.create();

        this.options = giclee.utils.objectConcat(
            {}, this._defaultOptions, options
        );

        this.$canvas = $canvas;
        this.canvas = $canvas.get(0);
        this.c = this.canvas.getContext("2d");

        this.pos = posCreate();
        this.document = document;

        this._initEvents();
        this._initClearup();

        if (this.options.initPos) {
            this.initPos(this.options.initPosScale);
        }

        this.draw();
    };

    /**
     * Sets the pos of the display so that the content in its document
     * is as large as possible, and centered. The scale is limited so
     * it is no bigger than the scale given.
     */
    Display.initPos = function(scaleLimit) {
        var document = this.document;
        var content = document.content;
        if (content.length === 0) return;
        if (scaleLimit === undefined) scaleLimit = 1000.0;

        var ModelFactory = this.options.ModelFactory;
        var posStack = [posCreate()];
        var bounds = [];
        for (var i = 0; i < content.length; i++) {
            var element = content[i];
            var model = ModelFactory.ensureAndGetModel(element, document);
            bounds.push(model.getGlobalBounds(posStack));
        }

        var aabb = AABB.createBounds.apply(AABB, bounds);
        var xywh = aabb.getXYWH();

        var w = this.$canvas.width(), h = this.$canvas.height();
        var scale = Math.min(scaleLimit, w/xywh[2], h/xywh[3]);

        var cx = (aabb.l + aabb.r)*0.5*scale;
        var cy = (aabb.t + aabb.b)*0.5*scale;
        this.pos.x = w*0.5 - cx;
        this.pos.y = h*0.5 - cy;
        this.pos.o = 0.0;
        this.pos.s = scale;
    };

    /**
     * This base object has no events to register, but this is
     * overloaded in subobjects.
     */
    Display._initEvents = function() {
    };

    /**
     * This base object has no other init to do, but subobjects might.
     */
    Display._initClearup = function() {
    };

    /**
     * Performs a complete redraw of the canvas.
     */
    Display.draw = function() {
        var c = this.c;
        var w = this.$canvas.width(), h = this.$canvas.height();
        var aabb = AABB.create(0, 0, w, h);

        c.setTransform(1, 0, 0, 1, 0, 0);
        this.redraw(aabb);
    };

    /**
     * Redraws the given part of the canvas.
     */
    Display.redraw = function(aabb) {
        var ModelFactory = this.options.ModelFactory;

        var c = this.c;
        c.clearRect.apply(c, aabb.getXYWH());

        var posStack = [this.pos];

        var document = this.document;
        var content = document.content;
        for (var i = 0; i < content.length; i++) {
            var element = content[i];
            var model = ModelFactory.ensureAndGetModel(element, document);
            model.renderGlobalCoords(c, posStack, aabb);
        }
    };

    // --------------------------------------------------------------------
    // The viewer displays a document on a canvas. A viewer can be used
    // to move around and zoom into some content, but cannot be used to
    // edit the content.
    // --------------------------------------------------------------------

    var Viewer = Display.extend();

    /**
     * Default options. Overriding this in subtypes is a little
     * tricky.
     */
    Viewer._defaultOptions = giclee.utils.objectConcat(
        {}, Display._defaultOptions,
        {
            // Our options here.
            initPosScale: 1.0,
            canRotateView: false,
            canScaleView: true,
            canPanView: true
        });

    /**
     * Initializes events.
     */
    Viewer._initEvents = function() {
        var that = this;
        this.$canvas.mousedown(function(event) {
            var w = that.$canvas.width(), h = that.$canvas.height();

            var dm = DragManager.create();
            dm.setPos(that.pos);
            dm.setRotateScaleOrigin({x:w*0.5, y:h*0.5}, true);
            dm.setLocks(
                !that.options.canPanView,
                !that.options.canRotateView,
                !that.options.canScaleView
            );
            dm.setRotateScaleOverride(event.shiftKey);
            dm.startTouch(1, {x:event.offsetX, y:event.offsetY});

            var move = function(event) {
                dm.setRotateScaleOverride(event.shiftKey);
                dm.moveTouch(1, {x:event.offsetX, y:event.offsetY});

                that.pos = posClone(dm.pos);
                that.draw();

                that.events.notify("view-changed", that.pos);
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
     * Returns the models of objects at the given global
     * coordinates.
     */
    Viewer.getModelsAt = function(xy) {
        var ModelFactory = this.options.ModelFactory;

        var posStack = [this.pos];
        var c = this.c;

        var result = [];
        var document = this.document;
        var content = document.content;
        for (var i = 0; i < content.length; i++) {
            var element = content[i];
            var model = ModelFactory.ensureAndGetModel(element, document);
            if (model.isGlobalPointInObject(c, posStack, xy)) {
                result.push(model);
            }
        }
        return result;
    };

    // --------------------------------------------------------------------
    // An overview is a type of display that shows the view bounds of
    // another display component.
    // --------------------------------------------------------------------

    var Overview = Display.extend();

    Overview._defaultOptions = giclee.utils.objectConcat(
        {}, Display._defaultOptions,
        {
            initPosScale: 0.15,
            viewBoxColor: "black",
            viewBoxHighlight: "white"
        });

    Overview.init = function($canvas, display, renderers, options) {
        this.display = display;
        Display.init.call(this, $canvas, display.document, renderers, options);
    };

    Overview._initClearup = function() {
    };

    Overview._initEvents = function() {
        this.display.events.register("view-changed", this.draw, this);

        // Handle dragging (interpreted as a drag of the linked view's
        // bounding area).
        var that = this;
        this.$canvas.mousedown(function(event) {
            var w = that.display.$canvas.width();
            var h = that.display.$canvas.height();

            var viewBoundsPos =
                that._viewBoundsPosFromDisplayPos(that.display.pos);

            var dm = DragManager.create();
            dm.setPos(viewBoundsPos);
            dm.setRotateScaleOrigin({x:w*0.5, y:h*0.5}, false);
            dm.setLocks(
                !that.display.options.canPanView,
                !that.display.options.canRotateView,
                !that.display.options.canScaleView
            );
            dm.setRotateScaleOverride(event.shiftKey);
            dm.startTouch(1, {x:event.offsetX, y:event.offsetY});

            var move = function(event) {
                dm.setRotateScaleOverride(event.shiftKey);
                dm.moveTouch(1, {x:event.offsetX, y:event.offsetY});

                that.display.pos =
                    that._displayPosFromViewBoundsPos(dm.pos);
                that.display.draw();
                that.display.events.notify("view-changed", that.pos);
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
     * Given the Pos of the linked display, figures out the pos of the
     * view bounding rectangle that needs to be drawn.
     */
    Overview._viewBoundsPosFromDisplayPos = function(displayPos) {
        var relativeScale = this.pos.s / displayPos.s;
        var x = -displayPos.x * relativeScale;
        var y = -displayPos.y * relativeScale;
        var o = this.pos.o - displayPos.o;
        var cos = Math.cos(o);
        var sin = Math.sin(o);
        return giclee.datatypes.posCreate(
            cos*x - sin*y + this.pos.x,
            sin*x + cos*y + this.pos.y,
            o,
            relativeScale
        );
    };

    /**
     * Given the Pos of the view boundig rectangle, calculates the pos
     * that should be set for the linked display. This is used to
     * update the linked display when moving or scaling the view
     * bounding rectangle.
     */
    Overview._displayPosFromViewBoundsPos = function(viewBoundsPos) {
        var oos = 1.0 / viewBoundsPos.s;
        var relativeScale = this.pos.s * oos;
        var x = (this.pos.x - viewBoundsPos.x) * oos;
        var y = (this.pos.y - viewBoundsPos.y) * oos;

        var cos = Math.cos(viewBoundsPos.o);
        var sin = Math.sin(viewBoundsPos.o);
        return giclee.datatypes.posCreate(
            cos*x + sin*y,
            -sin*x + cos*y,
            this.pos.o - viewBoundsPos.o,
            relativeScale
        );
    };

    /**
     * Redraws the given part of the canvas.
     */
    Overview.redraw = function(aabb) {
        Display.redraw.call(this, aabb);

        // Figure out the bounds of our linked display's window
        var displayCanvas = this.display.$canvas;
        var displayCanvasWidth = displayCanvas.width();
        var displayCanvasHeight = displayCanvas.height();
        var pos = this._viewBoundsPosFromDisplayPos(this.display.pos);

        // Draw the render bounds
        var c = this.c;
        c.save();
        giclee.datatypes.posSetTransform(pos, c);
        c.lineWidth = 3.0/pos.s;
        c.strokeStyle = this.options.viewBoxColor;
        c.strokeRect(0, 0, displayCanvasWidth, displayCanvasHeight);
        c.lineWidth = 1.0/pos.s;
        c.strokeStyle = this.options.viewBoxHighlight;
        c.strokeRect(0, 0, displayCanvasWidth, displayCanvasHeight);
        c.restore();
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.giclee === undefined) window.giclee = {};
    window.giclee.viewer = {
        Display: Display,
        Viewer: Viewer,
        Overview: Overview
    };

})(jQuery);