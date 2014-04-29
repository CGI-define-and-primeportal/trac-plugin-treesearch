/* =============================================================================
 * jquery.treesearch.js
 * =============================================================================
 * Author: Sivachandran Pushpanathan
 * Copyright: CGI 2014
 * About: Creates a tree view of files & folders for the searched key 
 * ===========================================================================*/

(function($) {
  $.fn.tree = function(options) {

    return this.each(function() {
      options = $.extend({}, $.fn.tree.defaults, options);
      new treeSearch($(this),options);
    });
  };

  // Default variables
  $.fn.tree.defaults = {
    REPO_URL:'d4',
    SERVER_URL:window.location
  };

  var treeSearch = Class.extend({

    /** 
     * DOM elements, error message & DOM events are instantiated here.
     * this.exceeds variable holds boolean response that the user is
     * searching beyond the elements in the repo path or not.
     * this.error holds boolean response, determines that we should show 
     * error message or element tree
     * this.pointer holds the current element
     */ 
    init: function($elm, options) {
      this.args = options;
      this.$elem = $elm.attr("autocomplete", "off").addClass("tree-input");
      this.uid = this.$elem.attr('id') + '-tree';
      this.$tree = $('<ul>').attr({
        'id': this.uid,
        'class': 'tree-container hidden'
      });
      
      this.$wrapper = $('<div>').attr('class','tree-wrapper');
      this.$elem.after(this.$wrapper);
      this.$wrapper.append(this.$elem, this.$tree);

      this.pointer = '';
      this.arrIndex = -1;
      this.prev_key = '';
      this.sliderOpen = false;

      this.exceeds = false;
      this.error = false;
      this.errormsg_exceeds = 'Search key exceeds the node value';
      this.errormsg_start = 'Search key should starts with /';
      this.errormsg_invalid = 'Search key does not match with elements in the path';

      this.events();
    },

    // EVENTS 
    events: function() {
      var _this = this;

      this.$elem.on("focus", $.proxy(this.display_tree, this));
      this.$elem.on("blur", $.proxy(this.hider, this));
      this.$elem.on("keydown", $.proxy(this.key_down, this));
      this.$elem.on("keyup", $.proxy(this.key_up, this));

      this.$tree.on("mousedown", ".icon-caret-right, .icon-caret-down",function(e) {
        e.stopPropagation();
        e.preventDefault();
        _this.slider($(this));
      });
      
      this.$tree.on("mouseover", ".level",function(){
        _this.hover_element($(this));
      });
      
      this.$tree.on("mouseleave", ".level",function(){
        $(this).removeClass('level-hover');
      });

      this.$tree.on("mousedown", ".level", function(e) {
        _this.populate($(".txt-data", this));
      });
    },

    /**
     * Hide tree container if the input box lost focus
     * Reset index value
     * Remove hover class from all list elements
     */
    hider: function(e) {
      if(!this.$tree.is(e.target) && this.$tree.has(e.target).length === 0) {
        this.$tree.addClass('hidden');
        $('.level-hover', this.$tree).removeClass('level-hover');
        this.arrIndex = -1;
      }
    },
    
    hover_element: function($node,key_hover) {
      if(!key_hover){
        this.arrIndex = -1;
      }

      $('.level-hover', this.$tree).trigger('mouseleave');
      $node.addClass('level-hover');
      this.pointer = $node.parent('li');

      if($node.data('ABS_PATH') == '/') {
        this.$elem.val('/');
      }
      else {
        this.$elem.val($node.data('ABS_PATH'));
      }
    },

    /**
     * Show tree only if there is value in input box
     * and has child nodes or error message
     */
    display_tree: function(e) {
      var tree_show = this.$elem.val() && (this.$tree.children('li').length || this.error);

      if(tree_show) {
        this.$tree.removeClass('hidden');
      }
    },

    /**
     * Show error message based on the error type
     * Errormsg_exceeds got the high priority than anyother error message
     */
    display_error: function(error_type) {
      this.error = true;

      if(this.exceeds) {
        error_type = this.errormsg_exceeds;
      }
      this.$tree.text(error_type).addClass('tree-error');
    },

    /** 
     * Function related to user type keys are defined here
     * KeyUp event will work only if the ignoreKeyUp value is false.
     */
    key_up: function(e) {
      var val = this.$elem.val();

      if(!this.ignoreKeyUp) {
        this.$tree.removeClass('hidden');

        /**
         * On pressing tab key from a input box, which triggers focus on
         * tree input, should not show tree container unless there is some 
         * value in input box
         */
        if(!val) {
          this.$tree.addClass('hidden');
        }

        // Check if the input data starts with /
        else if(!val.match('^/')) {
          this.display_error(this.errormsg_start);
        }

        // call BACKSPACE key handler
        else if(e.which == 8) {
          this.tree_backtrack(val);
        }

        // call FORWARD SLASH key handler
        else if(e.which == 191) {
          this.tree_lookahead(val);
        }

        else if(e.which == 9){
          this.ignoreKeyUp = false;
          return false;
        }

        // call REST OF KEY handler
        else{
          this.tree_traverse(val);
        }
      }

      this.ignoreKeyUp = false;
      return false;
    },

    /**
     * This method checks the availability of data in repo index initially. 
     * If not, then connect server through AJAX call, to get data
     * Based on the response, tree is builted.
     */
    tree_lookahead: function(val) {
      $nodes = this.process_data(val);

      if($nodes.length) {
        this.remove_error();
        this.$tree.html($nodes);
      }

      else {
        if($.isArray($nodes)) {
          this.exceeds = true;
          }
        this.display_error(this.errormsg_invalid);
      }
    },

    /**
     * This method resets error variables and remove error class
     */
    remove_error: function() {
      this.$tree.removeClass('tree-error');
      this.exceeds = false;
      this.error = false;
    },

    /**
     * This methods will take the data of previous success response
     * from repo index.
     * Built tree based on the response
     * If the input data and backtrack data is not equal, hide mismatch
     * elements from the list of nodes.
     */
    tree_backtrack: function(val) {
      var loopback_data = this.clean_data(val.split('/').slice(0,-1)).join('/'),
          current_val = '/',
          repoData;

      if(loopback_data) {
        current_val = '/' + loopback_data + '/';
      }

      repoData = repo_index(this.args.REPO_URL, current_val);

      if($.isEmptyObject(repoData)) {
        this.display_error(this.errormsg_invalid);
      }

      else {
        $nodes = this.build_HTML(repoData);
        this.remove_error();
        this.$tree.html($nodes);
      }

      if(current_val != val) {
        this.tree_traverse(val);
      }
    },

    /**
     * This methods traverse through all the nodes and check
     * if the node text value starts with input value or not.
     * The unmatched elements are set to hidden.
     */
    tree_traverse: function(data) {
      var tmp_data = this.clean_data(data.split('/')).pop(),
          $nodes = $('li',this.$tree),
          elm_value;

      if(!tmp_data) {
        return ; 
      }

      this.error = false;
      $nodes.each(function() {
        elm_value = $('div',$(this)).data('ELEM_VALUE');
        if(elm_value && !elm_value.match('^'+tmp_data)) {
          $(this).addClass('hidden');
        }
      });

      if($('li:visible',this.$tree).length == 0) {
        this.exceeds = false;
        this.display_error(this.errormsg_invalid);
      }
    },

    /**
     * Check the input key is available in repo index.
     * If not found, then connect server.
     * Construct tree with the response data
     */
    process_data: function(data) {
      var repoData = repo_index(this.args.REPO_URL, data);

      if(!repoData.length) {
        repoData = this.get_server_data(data);

        if(!repoData.length) {
          return repoData;
        }
      }
      return this.build_HTML(repoData);
    },

    /**
     * Based on the input received, li element is created.
     * @param data {'/':[{"isdir":true,"path":"/branches"},{"isdir":true,"path":"/tags"}]}
     * @return <HTML> node 
     */
    build_HTML: function(data) {
      var _this = this, 
          $nodes = $();

      $.each(data, function(index, value) {
        var pathData = _this.clean_data(value.path.split('/')),
            elmValue = pathData.pop() || '/',
            $node = $("<div>").addClass('level'),
            $span = $("<span class='txt-data'></span>").text(elmValue).appendTo($node),
            $icon = $("<i class='spacy'></i>").prependTo($span);
        
        $node.data({
            ABS_PATH:value.path,
            ELEM_VALUE:elmValue
            });

        if(value.isdir) {
          $node.prepend("<span class='icon-caret-right'></span>");
          $icon.addClass("icon-folder-close-alt");
        }

        else {
          $icon.addClass("icon-file-alt");
        }

        $node = $('<li>').append($node);
        $nodes = $nodes.add($node);
      });
      
      return $nodes;
    },

    /**
     * AJAX function to connect server
     * Update successful response data in repo index
     */
    get_server_data: function(data) {
      var _this = this, 
          ajxResp = '';

      $.ajax({
        type:'GET',
        url: _this.args.SERVER_URL,
        data: {
          q: data,
          format: 'json'
        },
        async:false,
        success: function(response) {
          ajxResp = response;
          repo_index(_this.args.REPO_URL, data, ajxResp);
        },
        error: function() {
          ajxResp = '';
        },
      });
      return ajxResp;
    },

    /**
     * Toggle function to show/hide child
     * Click event on right arrow, checks if the element
     * has child or not. If not, then call process data function
     * Click event on down arrow, hides all the child 
     */
    slider: function($node) {
      var $elmLi = $node.parent('div').parent('li'),
          $child = $elmLi.children('ul'),
          data = $node.parent('div').data('ABS_PATH'),
          $ul = $('<ul>');

      // Expand
      if($node.hasClass('icon-caret-right')) {
        $node.removeClass('icon-caret-right').addClass('icon-caret-down');

        if($child.length > 0) {
          $('>li',$child).removeClass('hidden');
        }
        else {
          var treeNodes = this.process_data(data+'/');
          if(treeNodes) {
            $elmLi.append($ul.append(treeNodes));
          }
        }

        if(this.$elem.val() != '/'){
          this.$elem.val(data+'/');
        }
        
      }

      // Collapse
      else {
        this.$elem.val(data);
        $node.removeClass('icon-caret-down').addClass('icon-caret-right');
        $('> li',$child).addClass('hidden');
      }
    },

    // Scroll the current element to top
    scroller: function($node) {
      var optionTop = $node.offset().top,
          selectTop = this.$tree.offset().top;

      this.$tree.scrollTop(this.$tree.scrollTop() + (optionTop - selectTop));
      return false;
    },

    // Remove empty spaces in an array
    clean_data: function(data) {
      return data.filter(function(f){return f;});
    },

    // Populates value on the input box
    populate: function($node, keepOpen) {
      var data = $node.parent('div').data('ABS_PATH');
      if(data != '/') {
         this.$elem.val(data);
      }

      if(!keepOpen) {
        this.$tree.addClass('hidden');
      }
      this.arrIndex = -1;
    },

    /**
     * The method to be executed on key down events are
     * defined here
     */
    key_down: function(e) {
      var $nodes = $(" > li:not(.hidden)",this.$tree),
          slideflag = false,
          preventDefault,
          $slideNode,
          $child_nodes;

      // ignore key up for SHIFT+TAB
      if(this.prev_key == 16 && e.which == 9){
        this.ignoreKeyUp = false;
        this.prev_key = e.which;
        return;
      }

      if(!$nodes.length || this.$tree.hasClass('hidden' )){
        this.ignoreKeyUp = false;
        return;
      }
      
      // loop through the nodes inside a parent slider open
      this.ignoreKeyUp = true;
      
      $nodes.each(function(){
        $child_nodes = $("ul > li:visible",$(this)).andSelf();
        if($child_nodes.length > 1){
          slideflag = true;
          $nodes = $child_nodes;
          return false;
        }
      });

      this.sliderOpen = slideflag? true : false;
      
      // Function call for DOWN ARROW keypress
      if(e.which == 40) {
        this.traverse_down($nodes);
      }

      // Function call for UP ARROW keypress
      else if(e.which == 38) {
        this.traverse_up($nodes);
        e.preventDefault();
      }

      /**
       * This method is to expand/collapse child of the current node
       * while pressing SIDE ARROW KEYS
       */
      else if(e.which == 37 || e.which == 39) {
        $slideNode = $('.icon-caret-right,.icon-caret-down',this.pointer).first();
        this.slider($slideNode);
      }

      // Function call for TAB keypress
      else if(e.which == 9) {
        preventDefault = this.autocomplete_text($nodes);
        if(preventDefault) e.preventDefault();
      }

      /**
       * Pressing ENTER key on the hovered element
       * populates the value in the input box
       */
      else if(e.which == 13) {
        this.$tree.addClass('hidden');
        e.preventDefault();
      }

      /**
       * For the rest of keys, clear preventdefault & proceed
       * key up event
       */
      else {
        preventDefault = false;
        this.ignoreKeyUp = false;
      }
      this.prev_key = e.which;
    },

    /**
     * This method traverse through the nodes in ascending order.
     * this.pointer holds the current element
     * For a single key press, hovers the current element and
     * remove the hover for the previous element
     */
    traverse_down: function($liNodes) {
      this.arrIndex = this.arrIndex + 1;
      if(this.arrIndex == $liNodes.length){
        this.arrIndex = 0;
      }
      this.pointer = $liNodes.eq(this.arrIndex);
      this.hover_element($('> div',this.pointer),true);
    },

    /**
     * This method is similar to traverse_down, except the index value 
     * is decremented for every keypress
     */
    traverse_up: function($liNodes) {
        this.arrIndex = this.arrIndex - 1;
        if(this.arrIndex == -1){
          this.arrIndex = $liNodes.length - 1;
        }
        this.pointer = $liNodes.eq(this.arrIndex);
        this.hover_element($('> div',this.pointer),true);
    },
    
    /**
     * Autocomplete the input box when TAB key is pressed.
     * If the node list is greater than one, then pressing tab key
     * will switchover to the other element.
     * For a single node in list, the value will be populated
     */
    autocomplete_text: function($nodes) {
      var $nodeText = $(".txt-data", $nodes),
          levelData,
          preventDefault = false;

      if($nodes.length == 1) {
        levelData = $('div', $nodes).data('ABS_PATH');
        if(levelData != this.$elem.val()) {
          preventDefault = true;
        }
        this.populate($nodeText, true);
      }

      if($nodes.length > 1) {
        this.traverse_down($nodes);
        preventDefault = true;
      }
      return preventDefault;
    },
  });

  var repos={};

  /**
   * This method will create an repo dictionary object contains
   * repository url, input data & server response 
   * repos = {'d4':{'/':'trunk}} 
   */
  function repo_index(repoUrl, key, val) {
    if(!repos[repoUrl]) {
      repos[repoUrl] = {};
    }

    if(val) {
      repos[repoUrl][key] = val;
    }

    return repos[repoUrl][key] || '';
  }
})(jQuery);

