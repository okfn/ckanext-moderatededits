HEAD_CODE = """
<link rel="stylesheet" href="/ckanext-moderatededits/css/main.css" 
      type="text/css" media="screen" /> 
<link rel="stylesheet" href="/ckanext-moderatededits/css/jquery-ui-1.8.13.custom.css" 
      type="text/css" media="screen" /> 
"""

BODY_CODE = """
<script type="text/javascript" src="/ckanext-moderatededits/jquery-1.5.2.min.js"></script>
<script type="text/javascript" src="/ckanext-moderatededits/jquery-ui-1.8.13.custom.min.js"></script>
<script type="text/javascript" src="/ckanext-moderatededits/diff_match_patch.js"></script>
<script type="text/javascript" src="/ckanext-moderatededits/moderatededits.js"></script>
<script type="text/javascript">
    jQuery.noConflict();
    jQuery('document').ready(function($){
        CKANEXT.MODERATEDEDITS.init('%(package_name)s', '%(revision_list_url)s', '%(revision_data_url)s');
    });
</script>
"""

REVISION_INFO_CODE = """
<div id="revision-info" class="revision-box">
    <ul>
        <li id="revision-info-moderator">
            <span class="revision-info-item">
                You are a moderator for this package.
                <a href="">Click here to find out what this means.</a>
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

REVISION_LIST_CODE = """
<div id="revision-list-widget" class="revision-box">
    <h3>Revisions</h3>
    <ul id="revision-list">
    </ul>
</div>
"""
