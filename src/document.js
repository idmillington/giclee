(function($) {

    // --------------------------------------------------------------------
    // The document contains the data to display.
    // --------------------------------------------------------------------

    var Document = inherit(ObjectBase);

    /**
     * Creates a new document with no content.
     */
    Document.init = function() {
        this.content = [];
    };

})(jQuery);