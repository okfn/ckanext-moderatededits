var CKANEXT = CKANEXT || {};
CKANEXT.MODERATEDEDITS = CKANEXT.MODERATEDEDITS || {};

(function(ns, $){
    ns.checkNotifications = function(url){
        var success = function(response){
            if(response.result.toLowerCase() === 'true'){
                $('#top-bar-login').css('max-width', '300px');
                notification = '<a id="pending-notification" href="' +
                    '/user/me#num_pending">Changes to approve</a>  &middot;';
                $('#top-bar-login span.ckan-logged-in').prepend(notification);
            }
        };

        $.ajax({method: 'GET',
                url: url,
                dataType: 'json',
                success: success
        }); 
    };
})(CKANEXT.MODERATEDEDITS, jQuery);
