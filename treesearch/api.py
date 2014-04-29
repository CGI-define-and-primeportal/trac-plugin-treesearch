from trac.core import Interface

class ITreeSearchViewer(Interface):
    def get_templates():
        """Return a dictionary like:
        {'ticket.html': ['#field-owner',],
                         ...
                         }
        """

