"""
CKAN Moderated Edits Extension

Adds the ability for all updates to CKAN packages to be moderated.

Moderated Edits is a CKAN extension - http://ckan.org/wiki/Extensions.
Enable by adding to your ckan.plugins line in the CKAN config::

    ckan.plugins = moderatededits
"""
import os
from logging import getLogger
log = getLogger(__name__)

from genshi.input import HTML
from genshi.filters import Transformer
from pylons import request, tmpl_context as c
from webob import Request
from ckan.lib.base import h
from ckan.plugins import SingletonPlugin, implements
from ckan.plugins.interfaces import (IConfigurable, IRoutes, 
                                     IGenshiStreamFilter, IConfigurer)

from ckanext.moderatededits import model
from ckanext.moderatededits import controller
from ckanext.moderatededits import html

class ModeratedEditsPlugin(SingletonPlugin):
    """
    """
    implements(IConfigurable)
    implements(IConfigurer, inherit=True)
    implements(IRoutes, inherit=True)
    implements(IGenshiStreamFilter)

    def update_config(self, config):
        """
        Called during CKAN setup.

        Add the public folder to CKAN's list of public folders,
        and add the templates folder to CKAN's list of template
        folders.
        """
        # add public folder to the CKAN's list of public folders
        here = os.path.dirname(__file__)
        public_dir = os.path.join(here, 'public')
        if config.get('extra_public_paths'):
            config['extra_public_paths'] += ',' + public_dir
        else:
            config['extra_public_paths'] = public_dir
        # add template folder to the CKAN's list of template folders
        template_dir = os.path.join(here, 'templates')
        if config.get('extra_template_paths'):
            config['extra_template_paths'] += ',' + template_dir
        else:
            config['extra_template_paths'] = template_dir

    def configure(self, config):
        """
        Called at the end of CKAN setup.
        """
        pass

    def before_map(self, map):
        """
        Setup routing.
        """
        return map

    def filter(self, stream):
        """
        Required to implement IGenshiStreamFilter.
        """
        routes = request.environ.get('pylons.routes_dict')

        # if this is the edit action of a package, call the javascript init function
        if(routes.get('controller') == 'package' and
           routes.get('action') == 'edit' and 
           c.pkg.id):
            data = {'package_name': c.pkg.name,
                    'revision_list_url': h.url_for(controller='package', action='history_ajax',
                                                   id=c.pkg.id),
                    'revision_data_url': h.url_for(controller='package', action='read_ajax')}
            # add CSS style
            stream = stream | Transformer('head').append(HTML(html.HEAD_CODE))
            # add javascript links
            stream = stream | Transformer('body').append(HTML(html.BODY_CODE % data))
            # add revision info box
            stream = stream | Transformer('body//div[@class="package"]//h2')\
                .after(HTML(html.REVISION_INFO_CODE))
            # add revision list widget
            stream = stream | Transformer('body//div[@id="primary"]')\
                .append(HTML(html.REVISION_LIST_CODE))
        return stream
