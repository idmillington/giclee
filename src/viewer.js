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
    var ResizeManager = giclee.managers.ResizeManager;

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
    Display.init = function($div, document, options) {
        var that = this;

        // Parameters.
        this.$div = $div;
        this.document = document;
        this.options = giclee.utils.objectConcat(
            {}, this._defaultOptions, options
        );

        // Create an event manager.
        this.events = giclee.managers.EventManager.create();

        // Make sure the div is fixed, relative or absolute positioned.
        var position = $div.css("position");
        if (!position || position == 'static' || position == 'inherit') {
            $div.css("position", "relative");
        }

        // Populate the div with a full size canvas. Eventually we may
        // use many of these for render acceleration and
        // caching.
        this._$canvas = $("<canvas>").css({
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        });
        this.$div.html(this._$canvas);
        this._c = this._$canvas.get(0).getContext("2d");

        // Register to resize the canvas.
        this._canvasResizeManager = ResizeManager.create(this._$canvas, $div);
        this._canvasResizeManager.events.register(
            "resize",
            function(event) {
                that.events.notify("resize", event);
                that.draw();
            }
        );

        // We start of uneditable.
        this.editMode = null;

        // Set up event listening.
        this._initEvents();

        // Set the initial view position.
        this.pos = posCreate();
        if (this.options.initPos) {
            this.initPos(this.options.initPosScale);
        }

        // Finally draw our contents.
        this.draw();
    };

    /**
     * This base object has no events to register, but this is
     * overloaded in subobjects.
     */
    Display._initEvents = function() {
        this._moveEventRegistered = null;
        this._touchEventRegistered = null;
    };

    /**
     * Called when the display receives a mouse move event.
     */
    Display._handleMove = function(event) {
        if (this.editMode && this.editMode.getRequiresMove()) {
            this.editMode.handleMove(this, event);
        } else {
            this._unregisterMoveEvent();
        }
    };

    /**
     * Called when the display receives a touch event.
     */
    Display._handleTouch = function(event) {
        if (this.editMode) {
            this.editMode.handleTouch(this, event);
        } else {
            this._unregisterTouchEvent();
        }
    };

    /**
     * We no longer want move events.
     */
    Display._unregisterMoveEvent = function() {
        this.$div.unbind('mousemove', this._moveEventRegistered);
        this._moveEventRegistered = null;
    };

    /**
     * We no longer want touch events.
     */
    Display._unregisterTouchEvent = function() {
        this.$div.unbind('mousedown', this._touchEventRegistered);
        this._touchEventRegistered = null;
    };

    /**
     * Sets the current edit mode for this display. Can be called with
     * null as an argument to clear the edit mode.
     */
    Display.setEditMode = function(editMode) {
        if (editMode == this.editMode) return;

        var that = this;
        this.editMode = editMode;

        // Check if the edit mode requires move.
        if (this.editMode && this.editMode.getRequiresMove()) {
            if (!this._moveEventRegistered) {
                this._moveEventRegistered = function(event) {
                    that._handleMove(event);
                    return false;
                };
                this.$div.bind('mousemove', this._moveEventRegistered);
            }
        } else {
            if (this._moveEventRegistered) {
                this._unregisterMoveEvent();
            }
        }

        // Register touches, if they aren't already
        if (this.editMode) {
            if (!this._touchEventRegistered) {
                this._touchEventRegistered = function(event) {
                    that._handleTouch(event);
                    return false;
                };
                this.$div.bind('mousedown', this._touchEventRegistered);
            }
        } else {
            if (this._touchEventRegistered) {
                this._unregisterTouchEvent();
            }
        }
    };

    /**
     * Sets the pos of the display so that the content in its document
     * is as large as possible, and centered. The scale is limited so
     * it is no bigger than the scale given.
     */
    Display.initPos = function(scaleLimit) {
        var document = this.document;
        var content = document.content;
        if (!content) return;
        if (scaleLimit === undefined) scaleLimit = 1000.0;

        var ModelFactory = this.options.ModelFactory;
        var posStack = [posCreate()];
        var model = ModelFactory.ensureAndGetModel(content, document);
        var aabb = model.getBounds(posStack);
        var xywh = aabb.getXYWH();

        var w = this.$div.width(), h = this.$div.height();
        var scale = Math.min(scaleLimit, w/xywh[2], h/xywh[3]);

        var cx = (aabb.l + aabb.r)*0.5*scale;
        var cy = (aabb.t + aabb.b)*0.5*scale;
        this.pos.x = w*0.5 - cx;
        this.pos.y = h*0.5 - cy;
        this.pos.o = 0.0;
        this.pos.s = scale;
    };

    /**
     * Performs a complete redraw of the canvas.
     */
    Display.draw = function() {
        var c = this._c;
        var w = this.$div.width(), h = this.$div.height();
        var aabb = AABB.create(0, 0, w, h);

        c.setTransform(1, 0, 0, 1, 0, 0);
        this.redraw(aabb);
    };

    /**
     * Sets the view pos of the display.
     */
    Display.setPos = function(pos) {
        this.pos.x = pos.x;
        this.pos.y = pos.y;
        this.pos.o = pos.o;
        this.pos.s = pos.s;
        this.events.notify('view-changed', this.pos);
        this.draw();
    };

    /**
     * Redraws the given part of the canvas.
     */
    Display.redraw = function(aabb) {
        var ModelFactory = this.options.ModelFactory;

        var c = this._c;
        c.clearRect.apply(c, aabb.getXYWH());

        var posStack = [this.pos];

        var document = this.document;
        var model = ModelFactory.ensureAndGetModel(document.content, document);
        model.render(c, posStack, aabb, {});
    };

    /**
     * Returns the models of objects at the given global coordinates,
     * in order from top to bottom.
     */
    Display.getModelsAt = function(xy) {
        var ModelFactory = this.options.ModelFactory;

        var posStack = [this.pos];
        var c = this._c;

        // TODO: Make this work. Its all or nothing here.
        var result = [];
        var document = this.document;
        var content = document.content;
        var model = ModelFactory.ensureAndGetModel(content, document);
        if (model.isPointInObject(c, posStack, xy)) {
            result.push(model);
        }

        return result;
    };


    // --------------------------------------------------------------------
    // The viewer is a display with a ChangeViewEditMode preset.
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
     * Creates a new viewer with a ChangeView edit mode.
     */
    Viewer.init = function($canvas, document, options) {
        Display.init.call(this, $canvas, document, options);
        this.setEditMode(giclee.edit.ChangeViewEditMode.create());
    };

    // --------------------------------------------------------------------
    // An overview is a type of display that shows the view bounds of
    // another display component. Can be set to have a custom edit
    // mode that allows the bounds to be dragged.
    // --------------------------------------------------------------------

    var Overview = Display.extend();

    Overview._defaultOptions = giclee.utils.objectConcat(
        {}, Display._defaultOptions,
        {
            initPosScale: 0.15,
            viewBoxColor: "#cc0000",
            viewBoxHighlight: "white",
            draggableBounds: true
        });

    Overview.init = function($canvas, display, options) {
        this.display = display;
        Display.init.call(this, $canvas, display.document, options);
        if (this.options.draggableBounds) {
            this.setEditMode(_OverviewEditMode.create());
        }
    };

    /**
     * Given the Pos of the linked display, figures out the pos of the
     * view bounding rectangle that needs to be drawn.
     */
    Overview.viewBoundsPosFromDisplayPos = function(displayPos) {
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
    Overview.displayPosFromViewBoundsPos = function(viewBoundsPos) {
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
        var displayElement = this.display.$div;
        var displayElementWidth = displayElement.width();
        var displayElementHeight = displayElement.height();
        var pos = this.viewBoundsPosFromDisplayPos(this.display.pos);

        // Draw the render bounds
        var c = this._c;
        c.save();
        giclee.datatypes.posSetTransform(pos, c);
        c.lineWidth = 3.0/pos.s;
        c.strokeStyle = this.options.viewBoxColor;
        c.strokeRect(0, 0, displayElementWidth, displayElementHeight);
        c.lineWidth = 1.0/pos.s;
        c.strokeStyle = this.options.viewBoxHighlight;
        c.strokeRect(0, 0, displayElementWidth, displayElementHeight);
        c.restore();
    };

    /**
     * Registers additionally to be told when its associated display changes.
     */
    Overview._initEvents = function() {
        this.display.events.register("view-changed", this.draw, this);
        this.display.events.register("resize", this.draw, this);
        Display._initEvents.call(this);
    };

    /**
     * An internal edit mode used for dragging the bounds around.
     */
    var _OverviewEditMode = giclee.edit.EditModeBase.extend();
    _OverviewEditMode.handleTouch = function(overview, event) {
        var w = overview.display.$div.width();
        var h = overview.display.$div.height();

        var viewBoundsPos =
            overview.viewBoundsPosFromDisplayPos(overview.display.pos);

        var dm = DragManager.create();
        dm.setPos(viewBoundsPos);
        dm.setRotateScaleOrigin({x:w*0.5, y:h*0.5}, false);
        dm.setLocks(
            !overview.display.options.canPanView,
            !overview.display.options.canRotateView,
            !overview.display.options.canScaleView
        );
        dm.setRotateScaleOverride(event.shiftKey);
        dm.startTouch(1, {x:event.offsetX, y:event.offsetY});

        var move = function(event) {
            dm.setRotateScaleOverride(event.shiftKey);
            dm.moveTouch(1, {x:event.offsetX, y:event.offsetY});

            overview.display.setPos(
                overview.displayPosFromViewBoundsPos(dm.pos)
            );
        };

        var up = function(event) {
            dm.endTouch(1, {x:event.offsetX, y:event.offsetY});

            overview.$div.unbind('mousemove', move);
            overview.$div.unbind('mouseup', up);
        };

        overview.$div.bind('mousemove', move);
        overview.$div.bind('mouseup', up);
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