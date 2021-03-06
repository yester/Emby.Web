define(['events'], function (Events) {

    function pluginManager() {

        var self = this;
        var plugins = [];

        // In lieu of automatic discovery, plugins will register dynamic objects
        // Each object will have the following properties:
        // name
        // type (theme, screensaver, etc)
        self.register = function (obj) {

            plugins.push(obj);
            Events.trigger(self, 'registered', [obj]);
        };

        self.ofType = function (type) {

            return plugins.filter(function (o) {
                return o.type == type;
            });
        };

        self.plugins = function () {
            return plugins;
        };

        self.mapRoute = function (plugin, route) {

            if (typeof plugin === 'string') {
                plugin = plugins.filter(function (p) {
                    return (p.id || p.packageName) == plugin;
                })[0];
            }

            route = route.path || route;

            if (route.toLowerCase().indexOf('http') == 0) {
                return route;
            }

            return '/plugins/' + plugin.id + '/' + route;
        };

        self.mapPath = function (plugin, path) {

            if (typeof plugin === 'string') {
                plugin = plugins.filter(function (p) {
                    return (p.id || p.packageName) == plugin;
                })[0];
            }

            return plugin.baseUrl + '/' + path;
        };

        // TODO: replace with each plugin version
        var cacheParam = new Date().getTime();

        self.mapUrl = function (plugin, path) {

            var url = self.mapPath(plugin, path);

            url += url.indexOf('?') == -1 ? '?' : '&';
            url += 'v=' + cacheParam;

            return url;
        };

        function loadTranslations(plugin, globalize) {
            var translations = plugin.getTranslations ? plugin.getTranslations() : [];
            return globalize.loadTranslations({
                name: plugin.id || plugin.packageName,
                translations: translations
            });
        }

        function definePluginRoute(route, plugin) {

            route.contentPath = self.mapPath(plugin, route.path);
            route.path = self.mapRoute(plugin, route);

            Emby.App.defineRoute(route, plugin.id);
        }

        self.loadPlugin = function (url) {

            console.log('Loading plugin: ' + url);

            return new Promise(function (resolve, reject) {

                require([url, 'globalize'], function (pluginFactory, globalize) {

                    var plugin = new pluginFactory();

                    // See if it's already installed
                    var existing = plugins.filter(function (p) {
                        return p.id == plugin.id;
                    })[0];

                    if (existing) {
                        resolve(url);
                        return;
                    }

                    plugin.installUrl = url;

                    var urlLower = url.toLowerCase();
                    if (urlLower.indexOf('http:') == -1 && urlLower.indexOf('https:') == -1 && urlLower.indexOf('file:') == -1) {
                        if (url.indexOf(Emby.Page.baseUrl()) != 0) {

                            url = Emby.Page.baseUrl() + '/' + url;
                        }
                    }

                    var separatorIndex = Math.max(url.lastIndexOf('/'), url.lastIndexOf('\\'));
                    plugin.baseUrl = url.substring(0, separatorIndex);

                    requirejs.config({
                        packages: [
                        {
                            name: plugin.id || plugin.packageName,
                            location: plugin.baseUrl,
                            main: plugin.installUrl
                        }]
                    });

                    self.register(plugin);

                    if (plugin.getRoutes) {
                        plugin.getRoutes().forEach(function (route) {
                            definePluginRoute(route, plugin);
                        });
                    }

                    if (plugin.type == 'theme') {

                        // translations won't be loaded for themes until needed
                        resolve(plugin);
                    } else {

                        loadTranslations(plugin, globalize).then(function () {
                            resolve(plugin);
                        }, reject);
                    }
                });
            });
        };
    }

    var instance = new pluginManager();
    window.Emby = window.Emby || {};
    window.Emby.PluginManager = instance;
    return instance;
});