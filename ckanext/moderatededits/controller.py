"""
CKAN Moderated Edits Extension
"""
from logging import getLogger
log = getLogger(__name__)

from ckan.lib.base import BaseController
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
    pass
