from pkg_resources import resource_filename
from trac.core import Component, implements
from trac.web.api import ITemplateStreamFilter
from trac.web.chrome import (ITemplateProvider, add_script, add_script_data,
                             add_stylesheet)
from trac.core import ExtensionPoint

from genshi.builder import tag
from genshi.filters.transform import Transformer

from api import ITreeSearchViewer

class TreeSearchOnSVN(Component):
    implements(ITreeSearchViewer)
    
    def get_templates(self):
        return {"diff_form.html": ['#new_path','#old_path'],
                'admin_authz.html': ['#path'],
                }

class TreeSearchSystem(Component):
    """A module providing a tree view for files and folders on a svn path search."""
    implements(ITemplateStreamFilter, ITemplateProvider)
    
    treesearchviewers = ExtensionPoint(ITreeSearchViewer)
    
    def get_htdocs_dirs(self):
        return [('treesearch', resource_filename(__name__, 'htdocs'))]
          
    def get_templates_dirs(self):
        return []

    # ITemplateStreamFilter methods
    def filter_stream(self, req, method, filename, stream, data):
        for treesearchviewer in self.treesearchviewers:
            d = treesearchviewer.get_templates()
            if filename in d:
                stream = self._enable_treesearch_for_page(req, stream, d[filename])
        return stream
        
    def _enable_treesearch_for_page(self, req, stream, fields):
        project_name = req.environ.get('SCRIPT_NAME')

        add_script(req, 'treesearch/js/treesearch.js')
        add_stylesheet(req, 'treesearch/css/treesearch.css')
        add_script_data(req,(('selector',','.join(fields)),('params',{'SERVER_URL': project_name + '/diff'})))

        stream = stream | Transformer('head').append(tag.script('''
               jQuery(document).ready(function() {
                 jQuery(selector).each(function() {
                   $(this).addClass('treesearch');
                   $(this).tree(params);
                 });
               });'''))
        return stream
