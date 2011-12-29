(function($) {

    // --------------------------------------------------------------------
    // The viewer displays a document on a canvas.
    // --------------------------------------------------------------------

    var Viewer = inherit(ObjectBase);

    /**
     * Creates a new viewer to connect the given canvas to the given
     * document.
     */
    Viewer.init = function($canvas, document) {
        this.document = document;
        this.$canvas = $canvas
        this.canvas = $canvas.get(0);
        this.c = this.canvas.getContext("2d");
    };

})(jQuery);