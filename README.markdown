CKAN Moderated Edits Extension
==============================

The moderated edits extension for CKAN adds the ability for all updates
to CKAN packages to be moderated.

**Current Status:** Alpha

Installation and Activation
---------------------------

To install the plugin, enter your virtualenv and install the source:

    $ pip install hg+http://bitbucket.org/johnglover/ckanext-moderatededits

This will also register a plugin entry point, so you now should be 
able to add the following to your CKAN .ini file:

    ckan.plugins = moderatededits
 
After you clear your cache and reload the site, the Moderated Edits plugin
and should be available. 

Tests
-----
From the ckanext-moderatededits directory, run:

    $ nosetests --ckan

Feedback
--------
Send any comments, queries, suggestions or bug reports to:
j @ johnglover dot net.
