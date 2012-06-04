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
     * mode, has received the given mouse movement event.
     */
    EditModeBase.handleMove = function(display, event) {
    };

    /**
     * Notification that the given display for which we're the edit
     * mode, has received the given touch event.
     */
    EditModeBase.handleTouch = function(display, event) {
    };

    // --------------------------------------------------------------------
    // An edit mode for panning and scaling the canvas.
    // --------------------------------------------------------------------

    PanAndScaleEditMode = EditModeBase.extend();

    /**
     * Handles a touch by registering for updates on the associated canvas.
     */
    PanAndScaleEditMode.handleTouch = function(display, event) {
        var w = display.$canvas.width(), h = display.$canvas.height();

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

            display.pos = posClone(dm.pos);
            display.draw();

            display.events.notify("view-changed", display.pos);
        };

        var up = function(event) {
            dm.endTouch(1, {x:event.offsetX, y:event.offsetY});

            display.$canvas.unbind('mousemove', move);
            display.$canvas.unbind('mouseup', up);
        };

        display.$canvas.bind('mousemove', move);
        display.$canvas.bind('mouseup', up);
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.giclee === undefined) window.giclee = {};
    window.giclee.edit = {
        EditModeBase: EditModeBase,
        PanAndScaleEditMode: PanAndScaleEditMode
    };


})();