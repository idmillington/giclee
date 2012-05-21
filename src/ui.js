(function($) {

    /**
     * Monkey patch the jquery event handler to add offsets on
     * platforms that don't have it.
     */
    (function() {
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

    /**
     * Clones the given selector from the library.
     */
    var clone = function(selector) {
        var library =  $("#library");
        var result = $(selector, library).clone();
        result.removeAttr('id');
        return result;
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.giclee === undefined) window.giclee = {};
    window.giclee.ui = {
        clone: clone
    };

})(jQuery);