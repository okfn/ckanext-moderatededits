// CKAN Moderated Edits Extension

var CKANEXT = CKANEXT || {};

CKANEXT.MODERATEDEDITS = {
    init:function(packageName, isModerator){
        this.packageName = packageName;
        this.isModerator = isModerator;

        $('body').removeClass("hide-sidebar");
        this.revisionInfo();
    },

    // display the revision information box
    revisionInfo:function(){
        var html = '';
        // html += '<h3>Revision Information</h3>';
        if(this.isModerator){
            html += '<span class="revision-info-item">';
            html += 'You are a moderator for this package. ';
            html += '<a href="">Click here to find out what this means.</a>';
            html += '</span>';
        }
        html += '<span class="revision-info-item">';
        html += 'Your changes are being compared to an unmoderated revision. ';
        html += '<a href="">Click here to compare them to the latest moderated revision.</a>';
        html += '</span>';
        $('div#revision-info').empty().append(html);
    }
};
