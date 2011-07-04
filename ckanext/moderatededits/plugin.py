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
from ckan.lib.base import h
from ckan.plugins import SingletonPlugin, implements
from ckan.plugins.interfaces import (IConfigurable, IRoutes, 
                                     IGenshiStreamFilter, IConfigurer)

from ckanext.moderatededits import controller
from ckanext.moderatededits import html

class ModeratedEditsPlugin(SingletonPlugin):
    """
    CKAN Moderated Edits Plugin
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
        # register that this plugin enforces moderation
        config['moderated'] = "true"

    def configure(self, config):
        """
        Called at the end of CKAN setup.
        """
        pass

    def before_map(self, map):
        """
        Setup routing.
        """
        map.connect('pending_edits', '/api/2/moderatededits/has_pending/{user}',
            controller='ckanext.moderatededits.controller:ModeratedEditsController',
            action='has_pending')
        return map

    def filter(self, stream):
        """
        Required to implement IGenshiStreamFilter.
        """
        routes = request.environ.get('pylons.routes_dict')

        # get any notifications
        notification_data = {
                'url': h.url_for(controller='ckanext.moderatededits.controller:ModeratedEditsController', 
                    action='has_pending', user=c.user
                )
        }
        stream = stream | Transformer('body').append(HTML(html.NOTIFICATIONS % notification_data))

        # if this is the edit action of a package, call the javascript init function
        controllers = ['package', 'ckanext.catalog.controller:CatalogController']
        if(routes.get('controller') in controllers and routes.get('action') == 'edit' and 
           c.pkg.id):
            if routes.get('controller') == 'package':
                data = {'package_name': c.pkg.name,
                        'revision_list_url': h.url_for(controller='package', action='history_ajax',
                                                       id=c.pkg.id),
                        'revision_data_url': h.url_for(controller='package', action='read_ajax')}
            else:
                data = {'package_name': c.pkg.name,
                        'revision_list_url': h.url_for(controller='ckanext.catalog.controller:CatalogController', 
                                                       action='history_ajax',
                                                       id=c.pkg.id),
                        'revision_data_url': h.url_for(controller='ckanext.catalog.controller:CatalogController', 
                                                       action='read_ajax')}

            # add CSS style
            stream = stream | Transformer('head').append(HTML(html.HEAD))
            # add javascript links
            stream = stream | Transformer('body').append(HTML(html.BODY % data))
            # add revision/moderator info boxes
            stream = stream | Transformer('body//div[@class="package"]/h2[1]')\
                .after(HTML(html.REVISION_INFO))
            # add revision list widget
            stream = stream | Transformer('body//div[@id="primary"]/ul')\
                .append(HTML(html.REVISION_LIST))

        # if this is the read action of a user page, show packages being followed
        elif(routes.get('controller') == 'user' and
             routes.get('action') == 'read' and 
             c.user):
            moderated_packages = controller.get_moderated_packages(c)
            mod_html = '<div class="moderation"><h3>Package Moderation</h3><ul>'
            mod_html += '<li><strong>Number of packages moderated:</strong> ' +\
                str(len(moderated_packages))
            mod_html += '</li>'
            if moderated_packages:
                mod_html += '<li><strong>Moderated packages:</strong> '
                for i, pkg in enumerate(moderated_packages):
                    mod_html += str(h.link_to(pkg.name, h.url_for(
                        controller='package', action='read', id=pkg.name
                    ))) 
                    if i < len(moderated_packages) - 1:
                        mod_html += ', '
                mod_html += '</li>'
                pending = [pkg for pkg in moderated_packages \
                    if not bool(pkg.latest_related_revision.approved_timestamp)]
                mod_html += '<a name="num_pending"></a>'
                mod_html += '<li><strong>Number of moderated packages ' +\
                    'with pending changes:</strong> '
                mod_html += str(len(pending)) + '</li>'
                if pending:
                    mod_html += '<li><strong>Packages with pending changes:</strong> '
                    for n, p in enumerate(pending):
                        mod_html += str(h.link_to(p.name, h.url_for(
                            controller='package', action='edit', id=p.name
                        ))) 
                        if n < len(pending) - 1:
                            mod_html += ', '
            mod_html += '</ul></div>'
            stream = stream | Transformer('body//div[@class="activity"]//ul')\
                .after(HTML(mod_html))
        return stream
