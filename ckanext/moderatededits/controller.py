"""
CKAN Moderated Edits Extension
"""
from logging import getLogger
log = getLogger(__name__)

from pylons.decorators import jsonify
from pylons import tmpl_context as c, request
from ckan.lib.base import BaseController, response
from ckan import model

def get_moderated_packages(context):
    """
    Return a list of all packages moderated by the user in the given context.
    """
    session = model.meta.Session()
    q = model.Session.query(model.PackageRole)
    q = q.filter_by(user=model.User.get(context.user), role=model.Role.ADMIN)
    return [model.Package.get(p.package_id) for p in q]

class ModeratedEditsController(BaseController):
    """
    The ckanext-moderatededits Controller.
    """
    @jsonify
    def has_pending(self, user):
        """
        Returns true if there are packages that are moderated by the given
        user that are in the 'pending' state.
        """
        if not user:
            response.status_int = 400
            return {'error': "No user specified"}

        if not user == request.environ.get('REMOTE_USER'):
            response.status_int = 403
            return {'error': "You are not authorized to make this request"}

        packages = get_moderated_packages(c)
        for p in packages:
            if not bool(p.latest_related_revision.approved_timestamp):
                return {'result': 'true'}

        return {'result': 'false'}
