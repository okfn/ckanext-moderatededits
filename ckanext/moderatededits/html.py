HEAD_CODE = """
<link rel="stylesheet" href="/ckanext-moderatededits/css/main.css" 
      type="text/css" media="screen" /> 
<link rel="stylesheet" href="/ckanext-moderatededits/css/buttons.css" 
      type="text/css" media="screen" /> 
"""

BODY_CODE = """
<script type="text/javascript" src="/ckanext-moderatededits/jquery-1.5.2.min.js"></script>
<script type="text/javascript" src="/ckanext-moderatededits/moderatededits.js"></script>
<script type="text/javascript">
    $('document').ready(function($){
        CKANEXT.MODERATEDEDITS.init('%(package_name)s', '%(revision_list_url)s', '%(revision_data_url)s');
                                    
    });
</script>
"""

REVISION_INFO_CODE = """
<div id="revision-info" class="revision-box"></div>
"""

REVISION_LIST_CODE = """
<div id="revision-list-widget" class="revision-box">
    <h3>Revisions</h3>
    <ul id="revision-list">
    </ul>
</div>
"""
