"""
CKAN Moderated Edits Extension
"""
from logging import getLogger
log = getLogger(__name__)

from pylons.i18n import _
from pylons.decorators import jsonify
from pylons import request, tmpl_context as c
from ckan.lib.base import BaseController, response, render, abort
from ckanext.moderatededits import model

class ModeratedEditsController(BaseController):
    """
    The ckanext-moderatededits Controller.
    """
    pass
