(function($) {
    // Import
    var ObjectBase = giclee.utils.ObjectBase;
    var DragManager = giclee.managers.DragManager;
    var posClone = giclee.datatypes.posClone;

    // --------------------------------------------------------------------
    // Base for edit operators.
    // --------------------------------------------------------------------

    var EditModeBase = ObjectBase.extend();

    /**
     * Overload this to indicate whether the mode should be notified
     * of cursor movement without a button press. Note that this
     * shouldn't be used for anything other than visual feedback, since
     * it is incompatible with most touch devices.
     */
    EditModeBase.getRequiresMove = function(display) {
        return false;
    };

    /**
     * Notification that the given display for which we're the edit
     * mode, has received the given mouse movement event. Note that
     * movement events will still be generated during a mouse drag, so
     * they should probably be filtered somehow.
     */
    EditModeBase.handleMove = function(display, event) {
    };

    /**
     * Notification that the given display for which we're the edit
     * mode, has received the given touch event.
     */
    EditModeBase.handleTouch = function(display, event) {
    };

    /**
     * Notification that the given display for which we're the edit
     * mode has received a mouse wheel event, which should adjust the
     * display by the given amount.
     */
    EditModeBase.handleMouseWheel = function(display, event, delta) {
    };

    // --------------------------------------------------------------------
    // An edit mode for panning and scaling the canvas.
    // --------------------------------------------------------------------

    ChangeViewEditMode = EditModeBase.extend();

    /**
     * Handles a touch by registering for updates on the associated canvas.
     */
    ChangeViewEditMode.handleTouch = function(display, event) {
        var w = display.$div.width(), h = display.$div.height();

        var dm = DragManager.create();
        dm.setPos(display.pos);
        dm.setRotateScaleOrigin({x:w*0.5, y:h*0.5}, true);
        dm.setLocks(
            !display.options.canPanView,
            !display.options.canRotateView,
            !display.options.canScaleView
        );
        dm.setRotateScaleOverride(event.shiftKey);
        dm.startTouch(1, {x:event.offsetX, y:event.offsetY});

        var move = function(event) {
            dm.setRotateScaleOverride(event.shiftKey);
            dm.moveTouch(1, {x:event.offsetX, y:event.offsetY});

            display.setPos(dm.pos);
        };

        var up = function(event) {
            dm.endTouch(1, {x:event.offsetX, y:event.offsetY});

            display.$div.unbind('mousemove', move);
            display.$div.unbind('mouseup', up);
        };

        display.$div.bind('mousemove', move);
        display.$div.bind('mouseup', up);
    };

    /**
     * Handles scrolling the mouse by zooming.
     */
    ChangeViewEditMode.handleMouseWheel = function(display, event) {
        if (!event.delta || !display.options.canScaleView) return;

        var newScale = Math.pow(1.4, event.delta);
        // TODO: Limit the scale?

        // Figure out where the mouse is.
        var x,y;
        if (event.offsetX !== undefined && event.offsetY !== undefined) {
            x = event.offsetX;
            y = event.offsetY;
        } else {
            x = display.$div.width()*0.5;
            y = display.$div.height()*0.5;
        }

        // Create a transform based on the given center points.
        var deltaPos = giclee.datatypes.posFromOriginOrientationScale(
            {x:x, y:y}, 0.0, newScale
        );
        var pos = giclee.datatypes.posConcat(deltaPos, display.pos);
        display.setPos(pos);
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.giclee === undefined) window.giclee = {};
    window.giclee.edit = {
        EditModeBase: EditModeBase,
        ChangeViewEditMode: ChangeViewEditMode
    };


})();