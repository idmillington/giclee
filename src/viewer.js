(function($) {
    // Import
    var ObjectBase = giclee.utils.ObjectBase;

    var ModelFactory = giclee.model.ModelFactory;

    var aabbCreate = giclee.datatypes.aabbCreate;

    var posCreate = giclee.datatypes.posCreate;
    var posCopy = giclee.datatypes.posCopy;
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
     * Test for and correct Mozilla's PointInPath bug (credit:
     * stackoverflow).
     */
    (function() {
        // Create a temporary canvas.
        var c = document.createElement("canvas").getContext("2d");
        c.translate(50, 0);
        c.moveTo(125, 50);
        c.arc(100, 50, 25, 0, 360, false);
        if (!c.isPointInPath(150, 50)) {
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
        }
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
        ModelFactory: ModelFactory.getGlobal()
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

        this.draw();
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

        c.setTransform(1, 0, 0, 1, 0, 0);
        this.redraw(0, 0, w, h);
    };

    /**
     * Redraws the given part of the canvas.
     */
    Display.redraw = function(x, y, w, h) {
        var ModelFactory = this.options.ModelFactory;

        var c = this.c;
        c.clearRect(x, y, w, h);

        var posStack = [this.pos];
        var aabb = aabbCreate(x, y, w, h);

        var content = this.document.content;
        for (var i = 0; i < content.length; i++) {
            var element = content[i];
            var model = ModelFactory.ensureAndGetModel(element);
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
     * tricky, see Viewer._defaultOptions for details.
     */
    Viewer._defaultOptions = giclee.utils.objectConcat(
        {}, Display._defaultOptions,
        {
            // Our options here.
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
            dm.setLocks(false, true, false);
            dm.setRotateScaleOverride(event.shiftKey);
            dm.startTouch(1, {x:event.offsetX, y:event.offsetY});

            var move = function(event) {
                dm.setRotateScaleOverride(event.shiftKey);
                dm.moveTouch(1, {x:event.offsetX, y:event.offsetY});

                that.pos = posCopy(dm.pos);
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
        var content = this.document.content;
        for (var i = 0; i < content.length; i++) {
            var element = content[i];
            var model = ModelFactory.ensureAndGetModel(element);
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
            viewBoxColor: "black",
            viewBoxHighlight: "white"
        });

    Overview.init = function($canvas, display, renderers, options) {
        this.display = display;
        Display.init.call(this, $canvas, display.document, renderers, options);
    };

    Overview._initClearup = function() {
        this.pos.s = 0.15;
    };

    Overview._initEvents = function() {
        this.display.events.register("view-changed", this.draw, this);
    };

    /**
     * Redraws the given part of the canvas.
     */
    Overview.redraw = function(x, y, w, h) {
        Display.redraw.call(this, x, y, w, h);

        // Draw the render bounds
        var c = this.c;
        var canvas = this.display.$canvas;
        var canvasWidth = canvas.width();
        var canvasHeight = canvas.height();
        var pos = giclee.datatypes.posCreate(
            -this.display.pos.x * this.pos.s / this.display.pos.s,
            -this.display.pos.y * this.pos.s / this.display.pos.s,
            0,
            this.pos.s / this.display.pos.s
        );

        c.save();
        giclee.datatypes.posSetTransform(pos, c);

        c.lineWidth = 3.0/pos.s;
        c.strokeStyle = this.options.viewBoxColor;
        c.strokeRect(0, 0, canvasWidth, canvasHeight);
        c.lineWidth = 1.0/pos.s;
        c.strokeStyle = this.options.viewBoxHighlight;
        c.strokeRect(0, 0, canvasWidth, canvasHeight);
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