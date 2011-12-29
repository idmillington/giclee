(function($) {
    // Import
    var ObjectBase = gce.utils.ObjectBase;
    var inherit = gce.utils.inherit;

    // --------------------------------------------------------------------
    // The document contains the data to display.
    // --------------------------------------------------------------------

    var Document = inherit(ObjectBase);

    /**
     * Creates a new document with the given raw content.
     */
    Document.init = function(content) {
        if (content === undefined) content = [];
        this.content = [
            {type:"foo", pos:{x:100, y:100, o:2, s:1.2}},
            {type:"foo", pos:{x:300, y:200, o:0.3, s:0.9}}
        ]; // content;
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.gce === undefined) window.gce = {};
    window.gce.document = {
        Document: Document
    };

})(jQuery);