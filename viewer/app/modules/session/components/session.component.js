(function() {

  'use strict';

  // local variable to save query state
  var _query = {  // set query defaults:
    length: 100,  // page length
    start : 0,    // first item index
    facets: 1,    // facets
    sorts : [{element:'fp', order:'asc'}] // array of sort objects
  };

  /**
   * @class SessionController
   * @classdesc Interacts with session list
   */
  class SessionController {

    /* setup --------------------------------------------------------------- */
    /**
     * Initialize global variables for this controller
     * @param $scope          Angular application model object
     * @param $location       Exposes browser address bar URL (based on the window.location)
     * @param $routeParams    Retrieve the current set of route parameters
     * @param $anchorScroll   Scrolls to the element related to given hash
     * @param SessionService  Transacts sessions with the server
     *
     * @ngInject
     */
    constructor($scope, $location, $routeParams, $anchorScroll, SessionService) {
      this.$scope         = $scope;
      this.$location      = $location;
      this.$routeParams   = $routeParams;
      this.$anchorScroll  = $anchorScroll;
      this.SessionService = SessionService;

      // offset anchor scroll position to account for navbars
      this.$anchorScroll.yOffset = 140;
    }

    /* Callback when component is mounted and ready */
    $onInit() { // initialize scope variables
      this.loading      = true;
      this.currentPage  = 1;    // always start on the first page

      this.query = _query;      // load saved query

      this.stickySessions = []; // array of open sessions

      // this.graphOptions = {     // flot graph options
      //   series: {
      //     bars: { show: true, fill: 1, barWidth: 3600/1.7 },
      //     color: '#28A482'
      //   }
        // series: {
        //   lines: {
        //     show: false,
        //     fill: true
        //   },
        //   bars: {
        //     show: true,
        //     fill: 1,
        //     barWidth: 3600/1.7
        //     // barWidth: interval / 1.7
        //   },
        //   points: {
        //     show: false
        //   },
        //   color: '#000000',
        //   shadowSize: 0
        // },
        // xaxis: {
        //   mode: 'time',
        //   label: 'Datetime',
        //   color: '#000',
        //   // tickFormatter: function(v, axis) {
        //   //   return dateString(v/1000, '<br>');
        //   // },
        //   // min: allGraphData.xmin || null,
        //   // max: allGraphData.xmax || null
        //   min: 1476304087000,
        //   max: 1476307687340
        // },
        // yaxis: {
        //   min: 0,
        //   color: '#000'
        //   // tickFormatter: function(v, axis) {
        //   //   return numberWithCommas(v);
        //   // }
        // },
        // selection: {
        //   mode: 'x',
        //   color: '#000'
        // },
        // zoom : {
        //   interactive: false,
        //   trigger: 'dblclick',
        //   amount: 2
        // },
        // pan : {
        //   interactive: false,
        //   cursor: 'move',
        //   frameRate: 20
        // },
        // legend: {
        //   position: 'nw'
        // },
        // grid: {
        //   backgroundColor: '#fff',
        //   borderWidth: 0,
        //   borderColor: '#000',
        //   color: '#ddd',
        //   hoverable: true,
        //   clickable: true
        // }
      // };

      this.getColumnInfo();     // get column infomation

      /* Listen! */
      // watch for the sorting changes (from colheader.component)
      this.$scope.$on('change:sort', (event, args) => {
        _query.sorts = this.query.sorts = args.sorts;

        this.getData();
      });

      // watch for pagination changes (from pagination.component)
      this.$scope.$on('change:pagination', (event, args) => {
        // pagination affects length, currentPage, and start
        _query.length = this.query.length = args.length;
        _query.start  = this.query.start  = args.start;

        this.currentPage = args.currentPage;

        this.getData();
      });

      // watch for search expression and date range changes
      // (from search.component)
      // IMPORTANT: this kicks off the inital search query
      this.$scope.$on('change:search', (event, args) => {
        // either startTime && stopTime || date
        if (args.startTime && args.stopTime) {
          _query.startTime  = this.query.startTime  = args.startTime;
          _query.stopTime   = this.query.stopTime   = args.stopTime;
          _query.date       = this.query.date       = null;
        } else if (args.date) {
          _query.date       = this.query.date       = args.date;
          _query.startTime  = this.query.startTime  = null;
          _query.stopTime   = this.query.stopTime   = null;
        }

        _query.expression = this.query.expression = args.expression;

        // reset the user to the first page, because we are issuing a new query
        // and there may only be 1 page of results
        _query.start = this.query.start = 0;

        this.getData();
      });

      // watch for additions to search parameters from session detail
      this.$scope.$on('add:to:search', (event, args) => {
        // notify children (namely expression typeahead)
        this.$scope.$broadcast('add:to:typeahead', args);
      });

      // watch for changes to time parameters from session detail
      this.$scope.$on('change:time', (event, args) => {
        // notify children (namely search component)
        this.$scope.$broadcast('update:time', args);
      });
    } /* /$onInit */


    /* exposed functions --------------------------------------------------- */
    /**
     * Makes a request to the Session Service to get the list of sessions
     * that match the query parameters
     */
    getData() {
      this.loading  = true;
      this.error    = false;

      this.stickySessions = []; // clear sticky sessions

      this.SessionService.get(this.query)
        .then((response) => {
          this.loading  = false;
          this.error    = false;
          this.sessions = response.data;

          this.graphData = response.data.graph;
        })
        .catch((error) => {
          this.loading  = false;
          this.error    = error;
        });
    }

    getColumnInfo() {
      this.SessionService.getColumnInfo()
        .then((response) => {
          this.columnInfo = response.data;
        })
        .catch((error) => {
          this.columnInfoError = error;
        });
    }

    /**
     * Toggles the display of the session detail for each session
     * @param {Object} session The session to expand, collapse details
     */
    toggleSessionDetail(session) {
      session.expanded = !session.expanded;

      if (session.expanded) {
        this.stickySessions.push(session);
      } else {
        var index = this.stickySessions.indexOf(session);
        if (index >= 0) { this.stickySessions.splice(index, 1); }
      }
    }

    /**
     * Determines if the table is being sorted by specified column
     * @param {string} id The id of the column
     */
    isSorted(id) {
      for (var i = 0; i < this.query.sorts.length; ++i) {
        if (this.query.sorts[i].element === id) { return true; }
      }

      return false;
    }

  }

  SessionController.$inject = ['$scope', '$location', '$routeParams',
    '$anchorScroll', 'SessionService'];


  angular.module('moloch')
    .component('session', {
      template  : require('html!../templates/session.html'),
      controller: SessionController
    });

})();
