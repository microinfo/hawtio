angular.module('FuseIDE', ['bootstrap', 'ngResource']).
        config(($routeProvider) => {
          $routeProvider.
                  when('/preferences', {templateUrl: 'partials/preferences.html'}).
                  when('/attributes', {templateUrl: 'partials/attributes.html', controller: DetailController}).
                  when('/charts', {templateUrl: 'partials/charts.html', controller: ChartController}).
                  when('/chartSelect', {templateUrl: 'partials/chartSelect.html', controller: ChartSelectController}).
                  when('/logs', {templateUrl: 'partials/logs.html', controller: LogController}).
                  when('/browseQueue', {templateUrl: 'partials/browseQueue.html', controller: BrowseQueueController}).
                  when('/browseEndpoint', {templateUrl: 'partials/browseEndpoint.html', controller: BrowseEndpointController}).
                  when('/sendMessage', {templateUrl: 'partials/sendMessage.html', controller: SendMessageController}).
                  when('/routes', {templateUrl: 'partials/routes.html', controller: CamelController}).
                  when('/subscribers', {templateUrl: 'partials/subscribers.html', controller: SubscriberGraphController}).
                  when('/createEndpoint', {templateUrl: 'partials/createEndpoint.html', controller: EndpointController}).
                  when('/createQueue', {templateUrl: 'partials/createQueue.html', controller: DestinationController}).
                  when('/createTopic', {templateUrl: 'partials/createTopic.html', controller: DestinationController}).
                  when('/deleteQueue', {templateUrl: 'partials/deleteQueue.html', controller: DestinationController}).
                  when('/deleteTopic', {templateUrl: 'partials/deleteTopic.html', controller: DestinationController}).
                  when('/debug', {templateUrl: 'partials/debug.html', controller: DetailController}).
                  when('/help', {
                    redirectTo: '/help/overview'
                  }).
                  when('/help/:tabName', {templateUrl: 'partials/help.html', controller: NavBarController}).
                  otherwise({redirectTo: '/help/overview'});
        }).
        factory('workspace',($rootScope, $location) => {
          var url = $location.search()['url'] || "/jolokia";
          return new Workspace(url, $location);
        }).
        filter('humanize', () => humanizeValue);


function NavBarController($scope, $location, workspace:Workspace) {
  $scope.workspace = workspace;

  $scope.validSelection = (uri) => workspace.validSelection(uri);

  // when we change the view/selection lets update the hash so links have the latest stuff
  $scope.$on('$routeChangeSuccess', function () {
    var hash = $location.search();
    // TODO there must be a nice function somewhere to do this in a nicer way!
    // NOTE we are not encoding anything
    var text = "";
    if (hash) {
      for (var key in hash) {
        var value = hash[key];
        if (key && value) {
          if (text.length === 0) {
            text = "?";
          } else {
            text += "&"
          }
          text += key + "=" + value;
        }
      }
    }
    $scope.hash = encodeURI(text);
  });

  $scope.navClass = (page) => {
    var currentRoute = $location.path().substring(1) || 'home';
    return currentRoute.startsWith(page) ? 'active' : '';
  };
}

function HelpController($scope, $routeParams, $location) {
  // Each time controller is recreated, check tab in url
  $scope.currentTab = $routeParams.tabName;

  // When we click on a tab, the directive changes currentTab
  $scope.$watch('currentTab', function (name, oldName) {
    if (name !== oldName) {
      $location.path('help/' + name);
    }
  });
}

function PreferencesController($scope, workspace:Workspace) {
  $scope.workspace = workspace;
  $scope.updateRate = workspace.getUpdateRate();

  $scope.$watch('updateRate', () => {
    $scope.workspace.setUpdateRate($scope.updateRate);
  });

  $scope.gotoServer = (url) => {
    console.log("going to server: " + url);
    //window.location = "#/attributes?url=" + url;
    window.open("#/attributes?url=" + encodeURIComponent(url));
  }
}

function updateSelectionNode($location, node) {
  var key = null;
  if (node) {
    key = node['key'];
  }
  var q = $location.search();
  if (key) {
    q['nid'] = key
  }
  $location.search(q);
}

function MBeansController($scope, $location, workspace:Workspace) {
  $scope.workspace = workspace;
  $scope.tree = new Folder('MBeans');
  $scope.counter = 0;

  $scope.$on("$routeChangeSuccess", function (event, current, previous) {
    // lets do this asynchronously to avoid Error: $digest already in progress
    setTimeout(updateSelectionFromURL, 50);
  });

  $scope.$watch('workspace.operationCounter', function () {
    $scope.counter += 1;
    loadTree();
    //setTimeout(loadTree, 1);
  });

  $scope.select = (node) => {
    $scope.workspace.selection = node;
    updateSelectionNode($location, node);
    $scope.$apply();
  };

  function updateSelectionFromURL() {
    var key = $location.search()['nid'];
    if (key) {
      var node = $("#jmxtree").dynatree("getTree").activateKey(key);
      if (node) {
        node.expand(true);
      }
    }
  }

  function populateTree(response) {
    var rootId = 'root';
    var separator = '_';
    var tree = new Folder('MBeans');
    tree.key = rootId;
    var domains = response.value;
    for (var domain in domains) {
      var mbeans = domains[domain];
      for (var path in mbeans) {
        var entries = {};
        var folder = tree.getOrElse(domain);
        folder.domain = domain;
        if (!folder.key) {
          folder.key = rootId + separator + domain;
        }
        var folderNames = [domain];
        folder.folderNames = folderNames;
        folderNames = folderNames.clone();
        var items = path.split(',');
        var paths = [];
        items.forEach(item => {
          var kv = item.split('=');
          var key = kv[0];
          var value = kv[1] || key;
          entries[key] = value;
          paths.push(value);
        });

        var lastPath = paths.pop();
        paths.forEach(value => {
          folder = folder.getOrElse(value);
          folder.domain = domain;
          folderNames.push(value);
          folder.folderNames = folderNames;
          folder.key = rootId + separator + folderNames.join(separator);
          folderNames = folderNames.clone();
        });
        var mbeanInfo: NodeSelection = {
          key: rootId + separator + folderNames.join(separator) + separator + lastPath,
          title: trimQuotes(lastPath),
          domain: domain,
          path: path,
          paths: paths,
          objectName: domain + ":" + path,
          parent: folder,
          entries: entries
        };
        folder.getOrElse(lastPath, mbeanInfo);
      }
    }
    // TODO we should do a merge across...
    // so we only insert or delete things!
    $scope.tree = tree;
    if ($scope.workspace) {
      $scope.workspace.tree = tree;
    }
    $scope.$apply();

    var treeElement = $("#jmxtree");
    treeElement.dynatree({
      onActivate: function (node) {
        var data = node.data;
        $scope.select(data);
      },
      persist: false,
      debugLevel: 0,
      children: $scope.workspace.tree.children
    });
    if ($scope.counter > 1) {
      //console.log("Reloading the tree as counter is " + $scope.counter);
      treeElement.dynatree("getTree").reload();
    }
    updateSelectionFromURL();
  }

  function loadTree() {
    var jolokia = workspace.jolokia;
    jolokia.request(
            {type: 'list'},
            onSuccess(populateTree, {canonicalNaming: false, maxDepth: 2}));
  }

  //loadTree();
  // TODO auto-refresh the tree...
}

class Table {
  public columns = {};
  public rows = {};

  public values(row, columns) {
    var answer = [];
    if (columns) {
      for (name in columns) {
        //console.log("Looking up: " + name + " on row ");
        answer.push(row[name]);
      }
    }
    return answer;
  }

  public setRow(key, data) {
    this.rows[key] = data;
    Object.keys(data).forEach((key) => {
      // could store type info...
      var columns = this.columns;
      if (!columns[key]) {
        columns[key] = {name: key};
      }
    });
  }
}

function DetailController($scope, $routeParams, workspace:Workspace, $rootScope) {
  $scope.routeParams = $routeParams;
  $scope.workspace = workspace;

  $scope.isTable = (value) => {
    return value instanceof Table;
  };

  $scope.getAttributes = (value) => {
    if (angular.isArray(value) && angular.isObject(value[0])) return value;
    if (angular.isObject(value) && !angular.isArray(value)) return [value];
    return null;
  };

  $scope.rowValues = (row, col) => {
    return [row[col]];
  };

  var asQuery = (mbeanName) => {
    return { type: "READ", mbean: mbeanName, ignoreErrors: true};
  };

  var tidyAttributes = (attributes) => {
    var objectName = attributes['ObjectName'];
    if (objectName) {
      var name = objectName['objectName'];
      if (name) {
        attributes['ObjectName'] = name;
      }
    }
  };

  $scope.$watch('workspace.selection', function () {
    var node = $scope.workspace.selection;
    closeHandle($scope, $scope.workspace.jolokia);
    var mbean = null;
    if (node) {
      mbean = node.objectName;
    }
    var query = null;
    var jolokia = workspace.jolokia;
    var updateValues:any = function (response) {
      var attributes = response.value;
      if (attributes) {
        tidyAttributes(attributes);
        $scope.attributes = attributes;
        $scope.$apply();
      } else {
        console.log("Failed to get a response! " + response);
      }
    };
    if (mbean) {
      query = asQuery(mbean)
    } else if (node) {
      // lets query each child's details
      var children = node.children;
      if (children) {
        var childNodes = children.map((child) => child.objectName);
        var mbeans = childNodes.filter((mbean) => mbean);
        //console.log("Found mbeans: " + mbeans + " child nodes " + childNodes.length + " child mbeans " + mbeans.length);

        // lets filter out the collections of collections; so only have collections of mbeans
        if (mbeans && childNodes.length === mbeans.length && !ignoreFolderDetails(node)) {
          query = mbeans.map((mbean) => asQuery(mbean));
          if (query.length === 1) {
            query = query[0];
          } else if (query.length === 0) {
            query = null;
          } else {
            // now lets create an update function for each row which are all invoked async
            $scope.attributes = new Table();
            updateValues = function (response) {
              var attributes = response.value;
              if (attributes) {
                tidyAttributes(attributes);
                var mbean = attributes['ObjectName'];
                var request = response.request;
                if (!mbean && request) {
                  mbean = request['mbean'];
                }
                if (mbean) {
                  var table = $scope.attributes;
                  if (!(table instanceof Table)) {
                    table = new Table();
                    $scope.attributes = table;
                  }
                  table.setRow(mbean, attributes);
                  $scope.$apply();
                } else {
                  console.log("no ObjectName in attributes " + Object.keys(attributes));
                }
              } else {
                console.log("Failed to get a response! " + JSON.stringify(response));
              }
            };
          }
        }
      }
    }
    if (query) {
      // lets get the values immediately
      jolokia.request(query, onSuccess(updateValues));
      var callback = onSuccess(updateValues,
              {
                error: (response) => {
                  updateValues(response);
                }
              });

      // listen for updates
      if (angular.isArray(query)) {
        if (query.length >= 1) {
          var args = [callback].concat(query);
          var fn = jolokia.register;
          scopeStoreJolokiaHandle($scope, jolokia, fn.apply(jolokia, args));
        }
      } else {
        scopeStoreJolokiaHandle($scope, jolokia, jolokia.register(callback, query));
      }
    }
  });
}

function LogController($scope, $location, workspace:Workspace) {
  $scope.workspace = workspace;
  //$scope.logs = {};
  $scope.logs = [];
  $scope.toTime = 0;
  $scope.queryJSON = { type: "EXEC", mbean: logQueryMBean, operation: "logResultsSince", arguments: [$scope.toTime], ignoreErrors: true};

  $scope.filterLogs = function (logs, query) {
    var filtered = [];
    var queryRegExp = null;
    if (query) {
      queryRegExp = RegExp(query.escapeRegExp(), 'i'); //'i' -> case insensitive
    }
    angular.forEach(logs, function (log) {
      if (!query || Object.values(log).any((value) => value && value.toString().has(queryRegExp))) {
        filtered.push(log);
      }
    });
    return filtered;
  };

  $scope.logClass = (log) => {
    var level = log['level'];
    if (level) {
      var lower = level.toLowerCase();
      if (lower.startsWith("warn")) {
        return "warning"
      } else if (lower.startsWith("err")) {
        return "error";
      } else if (lower.startsWith("debug")) {
        return "info";
      }
    }
    return "";
  };

  var updateValues = function (response) {
    var logs = response.events;
    var toTime = response.toTimestamp;
    if (toTime) {
      $scope.toTime = toTime;
      $scope.queryJSON.arguments = [toTime];
    }
    if (logs) {
      var seq = 0;
      for (var idx in logs) {
        var log = logs[idx];
        if (log) {
          if (!$scope.logs.any((item) => item.message === log.message && item.seq === log.message && item.timestamp === log.timestamp)) {
            $scope.logs.push(log);
          }
        }
      }
      //console.log("Got results " + logs.length + " last seq: " + seq);
      $scope.$apply();
    } else {
      console.log("Failed to get a response! " + response);
    }
  };

  var jolokia = workspace.jolokia;
  jolokia.execute(logQueryMBean, "allLogResults", onSuccess(updateValues));

  // listen for updates adding the since
  var asyncUpdateValues = function (response) {
    var value = response.value;
    if (value) {
      updateValues(value);
    } else {
      console.log("Failed to get a response! " + response);
    }
  };

  var callback = onSuccess(asyncUpdateValues,
          {
            error: (response) => {
              asyncUpdateValues(response);
            }
          });

  scopeStoreJolokiaHandle($scope, jolokia, jolokia.register(callback, $scope.queryJSON));
}


