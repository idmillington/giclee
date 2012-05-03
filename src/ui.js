(function($) {

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