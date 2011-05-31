CKAN Moderated Edits Extension
==============================

The moderated edits extension for CKAN adds the ability for all updates
to CKAN packages to be moderated.

**Current Status:** Incomplete

Installation and Activation
---------------------------

To install the plugin, enter your virtualenv and install the source:

    $ pip install hg+http://bitbucket.org/johnglover/ckanext-moderatededits

This will also register a plugin entry point, so you now should be 
able to add the following to your CKAN .ini file:

    ckan.plugins = moderatededits
 
After you clear your cache and reload the site, the Moderated Edits plugin
and should be available. 

**Note:** Currently requires CKAN branch feature-1141-moderated-edits-ajax

Todo / Roadmap
--------------

* Fix style for revision list so that it is correctly aligned with the package edit form.
* Localise displayed dates.
* Show moderator help box for 'click here to find out what this means' link on package edit pages.
* Limit no. revisions shown in the revisions box, maybe show as separate pages with prev/next buttons.
* Display revision log messages
* Add ability to save a moderated revision
* Don't check values of empty fields such as the blank row for adding new resources or the blank
  rows for adding new extra key/value pairs

Tests
-----
From the ckanext-moderatededits directory, run:

    $ nosetests --ckan

Feedback
--------
Send any comments, queries, suggestions or bug reports to:
j @ johnglover dot net.
