HEAD = """
<link rel="stylesheet" href="/ckanext-moderatededits/css/main.css" 
      type="text/css" media="screen" /> 
<link rel="stylesheet" href="/ckanext-moderatededits/css/jquery-ui-1.8.13.custom.css" 
      type="text/css" media="screen" /> 
"""

BODY = """
<script type="text/javascript" src="/ckanext-moderatededits/jquery-ui-1.8.13.custom.min.js"></script>
<script type="text/javascript" src="/ckanext-moderatededits/diff_match_patch.js"></script>
<script type="text/javascript" src="/ckanext-moderatededits/moderatededits.js"></script>
<script type="text/javascript">
    jQuery('document').ready(function($){
        CKANEXT.MODERATEDEDITS.init('%(package_name)s', '%(revision_list_url)s', '%(revision_data_url)s');
    });
</script>
"""

NOTIFICATIONS = """
<script type="text/javascript" src="/ckanext-moderatededits/me-notifications.js"></script>
<script type="text/javascript">
    CKANEXT.MODERATEDEDITS.checkNotifications('%(url)s');
</script>
"""

REVISION_INFO = """
<div id="revision-info" class="revision-box">
    <ul>
        <li id="revision-info-editor">
            <span class="revision-info-item">
                Someone else has already started editing this form. 
                You can continue editing from where they left off by editing the form below 
                or start a new form using the currently values. 
                
                <button id="revision-info-editor-reset" type="button">
                Start a new form using the currently accepted values
                </button>
            </span>
        </li>
        <li id="revision-info-moderator">
            <span class="revision-info-item">
                You are a moderator for this package.
                <a id="revision-show-mod-info">Click here for more information.</a>
                <div id="revision-moderator-info">
                <p>Any community member can make changes to the metadata for a package and save
                them as a new revision. The revisions for a given package are listed in the
                "Revisions" panel on the right hand side of this page.</p>
                <p>However, these community changes are not displayed by default when a 
                package is viewed. First, a moderator must approve the changes.
                You can approve the current revision by clicking the 
                "Save And Approve" button at the bottom of the page.</p>
                </div>
            </span>
        </li>
        <li id="revision-info-link-to-latest">
            <span class="revision-info-item">
                Your changes are being compared to an unmoderated revision.
                <a id="revision-select-latest">Click here to compare them to the latest moderated revision.</a>
            </span>
        </li>
    </ul>
</div>
"""

REVISION_LIST = """
<div id="revision-list-widget" class="revision-box">
    <h3>Revisions</h3>
    <ul id="revision-list-new-revision">
        <li>New Revision (Not Saved)</li>
    </ul>
    <ul id="revision-list">
    </ul>
    <div id="revision-list-msg">
        Revisions that have been approved by the moderator are marked with a 
        <span class="revision-approved-marker">*</span>
    </div>
</div>
"""
