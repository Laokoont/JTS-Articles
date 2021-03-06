// Grid generator for http://www.redblobgames.com/pathfinding/
// Copyright 2014 Red Blob Games
// License: Apache v2
"use strict";
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
// Graph class.
//
// Weights are assigned to *nodes* not *edges*, but the pathfinder
// will need edge weights, so we treat an edge A->B as having the
// weight of tile B. If a tile weight is Infinity we don't expose
// edges to it.
var Graph = (function () {
    function Graph(num_nodes) {
        this.num_nodes = num_nodes;
        this._edges = []; // node id to list of node ids
        this._weights = []; // node id to number (could be Infinity)
        this._observers = []; // functions to call when data changes
        for (var id = 0; id < num_nodes; id++) {
            this._weights[id] = 1;
            this._edges[id] = [];
        }
    }
    // Weights are given to tiles, not edges, but the search interface
    // will only ask about edges. Weight of edge id1->id2 is of tile id2.
    Graph.prototype.tile_weight = function (id) {
        return this._weights[id];
    };
    Graph.prototype.set_tile_weight = function (id, w) {
        if (this._weights[id] != w) {
            this._weights[id] = w;
            this.notify_observers();
        }
    };
    Graph.prototype.tiles_with_given_weight = function (w) {
        var _this = this;
        if (w === void 0) { w = Infinity; }
        return d3.range(this.num_nodes).filter(function (id) { return _this._weights[id] == w; });
    };
    Graph.prototype.edge_weight = function (id1, id2) {
        if (!this.has_edge(id1, id2)) {
            return Infinity;
        }
        if (this._weights[id2] === undefined) {
            return 1;
        }
        return this._weights[id2];
    };
    // Is there an edge from id1 to id2?
    Graph.prototype.has_edge = function (id1, id2) {
        return this._edges[id1] && this._edges[id1].indexOf(id2) >= 0;
    };
    // All edges from id
    Graph.prototype.edges_from = function (id1) {
        var _this = this;
        var edges = this._edges[id1].filter(function (id2) { return _this.tile_weight(id2) != Infinity; });
        return edges;
    };
    // All edges as a list of [id1, id2]
    Graph.prototype.all_edges = function () {
        var all = [];
        for (var id1 = 0; id1 < this.num_nodes; id1++) {
            this._edges[id1].forEach(function (id2) { return all.push([id1, id2]); });
        }
        return all;
    };
    // Observers get notified when the graph changes
    Graph.prototype.notify_observers = function () {
        this._observers.forEach(function (f) { return f(); });
    };
    Graph.prototype.add_observer = function (f) {
        this._observers.push(f);
        f();
    };
    // Make a proxy graph object, to share some things but override
    // some methods for comparison diagrams
    Graph.prototype.make_proxy = function () {
        var proxy = {};
        for (var field in this) {
            proxy[field] = this[field];
        }
        return proxy;
    };
    return Graph;
})();
// Each graph type is paired with a layout that maps ids to positions and shapes
var GraphLayout = (function () {
    function GraphLayout(graph, SCALE) {
        this.graph = graph;
        this.SCALE = SCALE;
    }
    // Return min/max x/y for the entire graph; caller needs size and offset
    GraphLayout.prototype.coordinate_range = function () {
        var min = [Infinity, Infinity];
        var max = [-Infinity, -Infinity];
        for (var id = 0; id < this.graph.num_nodes; id++) {
            var center = this.tile_center(id);
            var path = this.tile_shape(id);
            for (var j = 0; j < path.length; j++) {
                for (var axis = 0; axis < 2; axis++) {
                    min[axis] = Math.min(min[axis], center[axis] + path[j][axis]);
                    max[axis] = Math.max(max[axis], center[axis] + path[j][axis]);
                }
            }
        }
        return { min: min, max: max };
    };
    // Override these in the child class
    GraphLayout.prototype.tile_center = function (id) {
        return [0, 0];
    };
    GraphLayout.prototype.tile_shape = function (id) {
        return [[0, 0]];
    };
    GraphLayout.prototype.pixel_to_tile = function (coord) {
        return -1;
    };
    return GraphLayout;
})();
// Generate a grid of squares, to be used as a graph.
var SquareGrid = (function (_super) {
    __extends(SquareGrid, _super);
    // The class creates the structure of the grid; the client can
    // directly set the weights on nodes.
    function SquareGrid(W, H) {
        var _this = this;
        _super.call(this, W * H);
        this.W = W;
        this.H = H;
        for (var x = 0; x < W; x++) {
            for (var y = 0; y < H; y++) {
                var id = this.to_id(x, y);
                SquareGrid.DIRS.forEach(function (dir) {
                    var x2 = x + dir[0], y2 = y + dir[1];
                    if (_this.valid(x2, y2)) {
                        _this._edges[id].push(_this.to_id(x2, y2));
                    }
                });
            }
        }
    }
    SquareGrid.prototype.edges_from = function (id1) {
        var edges = _super.prototype.edges_from.call(this, id1);
        var xy = this.from_id(id1);
        if ((xy[0] + xy[1]) % 2 == 0) {
            // This is purely for aesthetic purposes on grids -- using a
            // checkerboard pattern, flip every other tile's edges so
            // that paths along diagonal lines end up stairstepping
            // instead of doing all east/west movement first and then
            // all north/south.
            edges.reverse();
        }
        return edges;
    };
    // Encode/decode grid locations (x,y) to integers (id)
    SquareGrid.prototype.valid = function (x, y) {
        return 0 <= x && x < this.W && 0 <= y && y < this.H;
    };
    SquareGrid.prototype.to_id = function (x, y) {
        return x + y * this.W;
    };
    SquareGrid.prototype.from_id = function (id) {
        return [id % this.W, Math.floor(id / this.W)];
    };
    SquareGrid.DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    return SquareGrid;
})(Graph);
var SquareGridLayout = (function (_super) {
    __extends(SquareGridLayout, _super);
    function SquareGridLayout() {
        _super.apply(this, arguments);
    }
    // Layout -- square tiles
    SquareGridLayout.prototype.xy_scaled = function (xy) {
        return [xy[0] * this.SCALE, xy[1] * this.SCALE];
    };
    SquareGridLayout.prototype.tile_center = function (id) {
        return this.xy_scaled(this.graph.from_id(id));
    };
    SquareGridLayout.prototype.tile_shape = function (id) {
        var S = this.SCALE;
        return [
            [-S / 2, -S / 2],
            [-S / 2, S / 2 - 1],
            [S / 2 - 1, S / 2 - 1],
            [S / 2 - 1, -S / 2]
        ];
    };
    SquareGridLayout.prototype.pixel_to_tile = function (coord) {
        return this.graph.to_id(Math.round(coord[0] / this.SCALE), Math.round(coord[1] / this.SCALE));
    };
    return SquareGridLayout;
})(GraphLayout);
// Search algorithm for http://www.redblobgames.com/pathfinding/
// Copyright 2013 Red Blob Games
// License: Apache v2
// **********************************************************************
//
//
// NOTE:
// This code is designed for generating diagrams and is not necessarily
// the best way to implement the search algorithms in your own project.
//
// If you want to see code that you can use in your own project, see
// <http://www.redblobgames.com/pathfinding/a-star/implementation.html>
//
//
//
// ********************************************************************************
"use strict";
// The search algorithm takes a set of start points, graph
// (read-only), and a map (read-write). We assume map doesn't have
// 'visited' field set. We'll set the 'cost_so_far', 'sort_key', and
// 'parent' fields of the map. The algorithm modifies map in place,
// and returns its internal state at the time it stopped.
var SearchState = (function () {
    function SearchState(steps, current, frontier, neighbors) {
        this.steps = steps;
        this.current = current;
        this.frontier = frontier;
        this.neighbors = neighbors;
    }
    return SearchState;
})();
var SearchOptions = (function () {
    function SearchOptions(starts, exit_now, sort_key) {
        if (starts === void 0) { starts = []; }
        this.starts = starts;
        this.exit_now = exit_now;
        this.sort_key = sort_key;
        // - starts (required) - list of start points
        // - exit_now function (optional) - return true if it's time to early exit
        // - sort_key (optional) - return a number for sorting the priority queue
        // - allow_reprioritize - true in general, but needs to be set to false for greedy best first search (ugly hack)
        this.allow_reprioritize = true;
        this.exit_now = this.exit_now || (function (_) { return false; });
        this.sort_key = this.sort_key || (function (id, node) { return node.cost_so_far; });
    }
    return SearchOptions;
})();
function search(options, graph, map) {
    var s = new SearchState(0, -1, options.starts.concat(), []);
    s.frontier.forEach(function (id, i) {
        map[id].steps = 0;
        map[id].cost_so_far = 0;
        map[id].visited = true;
        map[id].visit_order = i;
        map[id].sort_key = options.sort_key(id, map[id]);
    });
    // For stable sorting, I keep a counter for the elements inserted
    // into the frontier; this is used for breaking ties in the
    // priority queue key
    var visit_order = s.frontier.length;
    while (s.frontier.length > 0) {
        s.steps++;
        s.frontier.sort(function (a, b) { return map[a].sort_key == map[b].sort_key ? map[a].visit_order - map[b].visit_order : map[a].sort_key - map[b].sort_key; });
        s.current = s.frontier.shift();
        s.neighbors = graph.edges_from(s.current);
        if (options.exit_now(s)) {
            break;
        }
        s.neighbors.forEach(function (next) {
            var new_cost_so_far = (map[s.current].cost_so_far + graph.edge_weight(s.current, next));
            if (!map[next].visited || (options.allow_reprioritize && map[next].visited && new_cost_so_far < map[next].cost_so_far)) {
                if (s.frontier.indexOf(next) < 0) {
                    s.frontier.push(next);
                }
                map[next].steps = map[s.current].steps + 1;
                map[next].cost_so_far = new_cost_so_far;
                map[next].parent = s.current;
                map[next].visited = true;
                map[next].visit_order = visit_order++;
                map[next].sort_key = options.sort_key(next, map[next]);
            }
        });
    }
    if (s.frontier.length == 0) {
        // We actually finished the search, so internal state no
        // longer applies. NOTE: this code "smells" bad to me and I
        // should revisit it. I think I am missing one step of the iteration.
        s.current = -1;
        s.neighbors = [];
    }
    return s;
}
function test_search() {
    function test(a, b) {
        a = JSON.stringify(a);
        b = JSON.stringify(b);
        if (a != b)
            console.log("FAIL", a, "should be", b);
    }
    var G, map, ret, options;
    options = new SearchOptions();
    // Test full exploration with no early exit
    G = new SquareGrid(2, 2);
    map = d3.range(G.num_nodes).map(function (i) { return ({}); });
    ret = search(new SearchOptions([0]), G, map);
    test(map[3].cost_so_far, 2);
    test(map[1].parent, 0);
    test(ret.frontier, []);
    test(ret.neighbors, []);
    test(ret.current, -1);
    // Test grid with obstacles
    G = new SquareGrid(2, 2);
    G.set_tile_weight(1, Infinity);
    G.set_tile_weight(2, Infinity);
    map = d3.range(G.num_nodes).map(function (i) { return ({}); });
    ret = search(new SearchOptions([0]), G, map);
    test(map[3].cost_so_far, undefined);
    test(map[1].parent, undefined);
    test(ret.frontier, []);
    test(ret.neighbors, []);
    test(ret.current, -1);
    // Test early exit
    G = new SquareGrid(2, 2);
    G.set_tile_weight(2, Infinity);
    map = d3.range(G.num_nodes).map(function (i) { return ({}); });
    ret = search(new SearchOptions([0], function (s) { return s.current == 1; }), G, map);
    test(map[3].cost_so_far, undefined);
    test(map[1].parent, 0);
    test(ret.frontier, []);
    test(ret.neighbors, []);
    test(ret.current, -1);
}
test_search();
// From http://www.redblobgames.com/pathfinding/
// Copyright 2014 Red Blob Games <redblobgames@gmail.com>
// License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
///<reference path="d.ts/DefinitelyTyped/d3/d3.d.ts" />
///<reference path="grid.ts" />
///<reference path="search.ts" />
function svg_blob(radius) {
    var path = [];
    for (var angle = 0.0; angle < 2 * Math.PI; angle += 0.1) {
        var r = radius * (1 + Math.sin(5 * angle) / 5);
        var x = r * Math.cos(angle);
        var y = -r * Math.sin(angle);
        y -= 0.05 * radius; // adjust for blob head having less "weight" than feet
        path.push('L', x, y);
    }
    path[0] = 'M';
    path.push('Z');
    return path.join(" ");
}
function svg_cross(radius) {
    var R = radius;
    return ['M', -R, -R, 'L', R, R, 'M', -R, R, 'L', R, -R].join(" ");
}
function svg_points_to_path(points) {
    var svg = ['M', points[0]];
    for (var i = 1; i < points.length; i++) {
        svg.push('L', points[i]);
    }
    svg.push('Z');
    return svg.join(" ");
}
var Diagram = (function () {
    function Diagram(parent_selector, graph, options, layout, init_layers) {
        var _this = this;
        this.graph = graph;
        this.options = options;
        this.layout = layout;
        this.svg = null;
        this.parent = null;
        this._previous_map = undefined; // we keep this for drawing optimization
        this.layer = {}; // access to layers by name
        this.layer_array = []; // access in order
        this.linked_diagrams = [];
        this.graph.add_observer(this.redraw.bind(this));
        this.parent = d3.select(parent_selector);
        var svg_container = this.parent.append('svg');
        var range = this.layout.coordinate_range();
        svg_container.attr('width', range.max[0] - range.min[0] + 1).attr('height', range.max[1] - range.min[1] + 1);
        this.svg = svg_container.append('g');
        this.svg.attr('transform', "translate(" + [-range.min[0], -range.min[1]] + ")");
        init_layers.forEach(function (args) { return _this.add.apply(_this, args); });
        this.redraw();
    }
    // Add a diagram layer to this diagram
    Diagram.prototype.add = function (layerClass) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        function construct(constructor, args) {
            // From <http://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible>
            function Layer() {
                constructor.apply(this, args);
            }
            Layer.prototype = constructor.prototype;
            return new Layer();
        }
        var layer = construct(layerClass, [this].concat(args));
        this._previous_map = undefined; // invalidate cache
        this.layer[layer.name] = layer;
        this.layer_array.push(layer);
        return layer;
    };
    // Redraw these other diagrams when we redraw this one
    Diagram.prototype.link_to = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        this.linked_diagrams = this.linked_diagrams.concat(args);
    };
    // Redraw this diagrams and any others linked to it
    Diagram.prototype.redraw = function () {
        this._redraw();
        this.linked_diagrams.forEach(function (diagram) { return diagram._redraw(); });
    };
    // Redraw only this diagram
    Diagram.prototype._redraw = function () {
        var _this = this;
        var ids = d3.range(this.graph.num_nodes);
        var map = ids.map(function (id) { return ({ tile_weight: _this.graph.tile_weight(id) }); });
        var ss = search(this.options, this.graph, map);
        if (ss.current != -1) {
            map[ss.current].current = true;
        }
        ss.frontier.forEach(function (id) {
            map[id].frontier = true;
        });
        ss.neighbors.forEach(function (id) {
            map[id].neighbor = true;
        });
        this.layer_array.forEach(function (layer) {
            // If the layer states which fields it cares about, then we only have to redraw a tile if any one of those fields is changed
            var ids_to_redraw = ids;
            if (_this._previous_map !== undefined && layer.dependencies !== undefined) {
                ids_to_redraw = ids.filter(function (id) { return layer.dependencies.some(function (field) { return map[id][field] != _this._previous_map[id][field]; }); });
            }
            if (ids_to_redraw.length > 0) {
                layer.redraw(map, ss, d3.set(ids_to_redraw));
            }
        });
        this._previous_map = map;
    };
    return Diagram;
})();
var DiagramLayer = (function () {
    // Dependencies are an optional optimization: if it's not null, it should
    // be a set of field names from the 'map' array that affect drawing. The
    // Diagram class will calculate the set of ids that need to be updated,
    // and pass that as a parameter to redraw().
    function DiagramLayer(diagram, name, dependencies) {
        if (dependencies === void 0) { dependencies = undefined; }
        this.diagram = diagram;
        this.name = name;
        this.dependencies = dependencies;
        this.svg = this.diagram.svg.append('g').attr('class', this.name);
    }
    DiagramLayer.prototype.redraw = function (map, ss, id_set) {
    };
    // Return the id of the graph node currently pointed at. The
    // parent should be an touch/mouse event handler so that d3.event
    // is filled in.
    DiagramLayer.prototype.currently_pointing_at = function () {
        // This function has several cases. The problem is that the
        // layout class's pixel_to_tile is *optional*. I only define
        // it for grids. For non-grids, I get the id here by looking
        // at the svg node, which has its id. However, on touch
        // devices, the svg node returned is that where the touch drag
        // started, not where it is now, so that corner case isn't
        // handled at all here.
        var id = this.diagram.layout.pixel_to_tile(d3.mouse(this.svg.node()));
        // NOTE: if there's a css transform on the svg or parent,
        // Firefox will return the wrong mouse location. I haven't
        // traced this to figure out whether it's d3's fault or
        // Firefox's fault. Firefox may be handling the rotate but not
        // the translate.
        // Fallback is used only if pixel_to_tile returns -1 (e.g.
        // it's not a grid where it's easy to calculate). The fallback
        // works only for mouse pointers, not touch events.
        var target = d3.select(d3.event.sourceEvent.target);
        // There should be a tile on the base layer that has d3's data set to the tile id
        if (id < 0 && target !== undefined && target.classed('tile')) {
            id = target.data()[0];
        }
        // TODO: it may be better to use the touch/mouse location and
        // then find the dom node, using document.elementFromPoint
        // (firefox/webkit, not sure about use in svg for opera/ie) or
        // svg.getIntersectionList (webkit, ie, opera but not firefox)
        return id;
    };
    return DiagramLayer;
})();
var BaseLayer = (function (_super) {
    __extends(BaseLayer, _super);
    function BaseLayer(diagram) {
        var _this = this;
        _super.call(this, diagram, 'base', ['tile_weight', 'current', 'frontier', 'neighbor', 'visited']);
        this.diagram = diagram;
        this.svg.selectAll(".tile").data(d3.range(this.diagram.graph.num_nodes)).enter().append('path').attr('class', "tile").attr('transform', function (id) { return "translate(" + _this.diagram.layout.tile_center(id) + ")"; }).attr('d', function (id) { return svg_points_to_path(_this.diagram.layout.tile_shape(id)); });
    }
    BaseLayer.prototype.redraw = function (map, ss, id_set) {
        this.svg.selectAll(".tile").filter(function (id) { return id_set.has(id); }).attr('class', function (id) {
            var classes = ["tile", "weight-" + map[id].tile_weight];
            if (map[id].current)
                classes.push("current");
            if (map[id].frontier)
                classes.push("frontier");
            if (map[id].neighbor)
                classes.push("neighbor");
            if (map[id].visited)
                classes.push("visited");
            return classes.join(" ");
        });
    };
    return BaseLayer;
})(DiagramLayer);
var GraphEditorLayer = (function (_super) {
    __extends(GraphEditorLayer, _super);
    // Unlike most of the layers, this one reaches into the base layer
    function GraphEditorLayer(diagram, cycle_order) {
        var _this = this;
        _super.call(this, diagram, 'graph_editor');
        this.diagram = diagram;
        this.cycle_order = cycle_order;
        if (this.cycle_order === undefined) {
            this.cycle_order = [1, Infinity];
        }
        var new_weight = 0;
        var drag = d3.behavior.drag().on('dragstart', function (d) {
            new_weight = _this.next_weight(_this.diagram.graph.tile_weight(d));
        }).on('drag', function (d) {
            var id = _this.currently_pointing_at();
            if (id != -1) {
                _this.diagram.graph.set_tile_weight(id, new_weight);
            }
        });
        this.diagram.layer.base.svg.selectAll(".tile").on('click', function (id) {
            var new_weight = _this.next_weight(_this.diagram.graph.tile_weight(id));
            _this.diagram.graph.set_tile_weight(id, new_weight);
        }).call(drag);
    }
    // What's the next weight in cycle order? By default it toggles 1 and Infinity
    GraphEditorLayer.prototype.next_weight = function (weight) {
        var i = this.cycle_order.indexOf(weight);
        return this.cycle_order[(i + 1) % this.cycle_order.length];
    };
    return GraphEditorLayer;
})(DiagramLayer);
var Slider = (function () {
    function Slider(parent_selector, diagrams) {
        var _this = this;
        this.parent_selector = parent_selector;
        this.diagrams = diagrams;
        this.slider = null;
        this.play_pause_button = null;
        this.position = 0;
        this.max_value = 1;
        this.animation_id = null; // non-null means it's animating
        var parent = d3.select(parent_selector);
        this.max_value = this.diagrams[0].graph.num_nodes;
        this.diagrams.forEach(function (diagram) {
            var previous_exit_now = diagram.options.exit_now;
            diagram.options.exit_now = function (ss) { return previous_exit_now(ss) || (ss.steps > _this.position); };
        });
        var div = parent.append('div').attr('class', "slider").style('text-align', "center");
        this.slider = div.append('input').attr('type', "range").attr('min', 0).attr('max', this.max_value).attr('step', 1).attr('value', this.position).style('width', "95%").style('margin', "0").on('input', function () { return _this.set_slider_to(parseInt(_this.slider.node().value)); }).on('change', function () { return _this.set_slider_to(parseInt(_this.slider.node().value)); });
        div.append('br');
        div.append('button').attr('class', "step_back").on('click', function () { return _this.set_slider_to(_this.position - 1); }).text("<");
        this.play_pause_button = div.append('button').attr('class', "play_pause").on('click', function () { return _this.set_play_pause(_this.animation_id == null); });
        div.append('button').attr('class', "step_forward").on('click', function () { return _this.set_slider_to(_this.position + 1); }).text(">");
        this.set_slider_to(0);
    }
    Slider.prototype.loop = function () {
        this.diagrams.forEach(function (diagram) {
            diagram.redraw();
        });
        if (this.position < this.max_value) {
            this.set_position(Math.min(1 + this.position, this.max_value));
        }
        else {
            this.set_play_pause(false);
        }
    };
    Slider.prototype.set_play_pause = function (state) {
        this.play_pause_button.text(state ? "Pause animation" : "Start animation");
        if (state && this.animation_id == null) {
            this.animation_id = setInterval(this.loop.bind(this), 16);
            if (this.position == this.max_value) {
                // Reset back to the beginning
                this.set_position(0);
            }
        }
        else if (!state && this.animation_id != null) {
            clearInterval(this.animation_id);
            this.animation_id = null;
        }
    };
    Slider.prototype.set_slider_to = function (pos) {
        this.set_position(pos);
        this.diagrams.forEach(function (diagram) {
            diagram.redraw();
        });
        this.set_play_pause(false);
    };
    Slider.prototype.set_position = function (pos) {
        if (pos < 0) {
            pos = 0;
        }
        if (pos >= this.max_value) {
            pos = this.max_value;
        }
        this.position = pos;
        this.slider.node().value = pos;
    };
    return Slider;
})();
var EdgeLayer = (function (_super) {
    __extends(EdgeLayer, _super);
    function EdgeLayer(diagram) {
        _super.call(this, diagram, 'edges');
        this.diagram = diagram;
    }
    EdgeLayer.prototype.redraw = function (map, ss) {
    };
    return EdgeLayer;
})(DiagramLayer);
var NeighborsLayer = (function (_super) {
    __extends(NeighborsLayer, _super);
    function NeighborsLayer(diagram) {
        var _this = this;
        _super.call(this, diagram, 'neighbors');
        this.diagram = diagram;
        this.svg.selectAll(".edge").data(this.diagram.graph.all_edges()).enter().append('path').attr('class', "edge").attr('d', function (edge) {
            var xy0 = _this.diagram.layout.tile_center(edge[0]);
            var xy1 = _this.diagram.layout.tile_center(edge[1]);
            return ['M', xy0, 'L', [0.5 * (xy0[0] + xy1[0]), 0.5 * (xy0[1] + xy1[1])]].join(" ");
        });
    }
    NeighborsLayer.prototype.redraw = function (map, ss) {
        var _this = this;
        var n = this.svg.selectAll(".neighbor").data(ss.neighbors);
        n.exit().remove();
        n.enter().append('path').attr('class', "neighbor").attr('d', function (id) { return svg_points_to_path(_this.diagram.layout.tile_shape(id)); }).attr('fill', "none").attr('stroke-width', "4px").attr('stroke-opacity', 1.0).attr('stroke', d3.hsl(150, 0.5, 0.5));
        n.attr('transform', function (id) { return "translate(" + _this.diagram.layout.tile_center(id) + ")"; });
    };
    return NeighborsLayer;
})(DiagramLayer);
var ParentPointerLayer = (function (_super) {
    __extends(ParentPointerLayer, _super);
    function ParentPointerLayer(diagram) {
        _super.call(this, diagram, 'parent_pointers', ['parent']);
        this.diagram = diagram;
        var defs = this.diagram.parent.select("svg").insert('defs', ':first-child');
        var marker = defs.append('marker').attr('id', 'arrowhead').attr('viewBox', "0 0 10 10").attr('refX', 7).attr('refY', 5).attr('markerUnits', 'strokeWidth').attr('markerWidth', 4).attr('markerHeight', 3).attr('orient', 'auto');
        var path = marker.append('path').attr('d', "M 0 0 L 10 5 L 0 10 z");
        this.svg.selectAll("path.parent").data(d3.range(this.diagram.graph.num_nodes)).enter().append('path').attr('class', "parent").attr('d', "M 0 0").attr('marker-end', "url(#arrowhead)");
    }
    ParentPointerLayer.prototype.redraw = function (map, ss, id_set) {
        var _this = this;
        this.svg.selectAll(".parent").filter(function (id) { return id_set.has(id); }).attr('d', function (id1) {
            var id2 = map[id1].parent;
            if (id2 === undefined) {
                return "M 0 0";
            }
            var xy1 = _this.diagram.layout.tile_center(id1);
            var xy2 = _this.diagram.layout.tile_center(id2);
            var beg = [xy1[0] * 0.9 + xy2[0] * 0.1, xy1[1] * 0.9 + xy2[1] * 0.1];
            var end = [xy2[0] * 0.6 + xy1[0] * 0.4, xy2[1] * 0.6 + xy1[1] * 0.4];
            return ['M', beg, 'L', end].join(" ");
        });
    };
    return ParentPointerLayer;
})(DiagramLayer);
var NumericLabelLayer = (function (_super) {
    __extends(NumericLabelLayer, _super);
    function NumericLabelLayer(diagram, field, format) {
        var _this = this;
        _super.call(this, diagram, 'numeric_label_' + field, [field]);
        this.diagram = diagram;
        this.field = field;
        this.format = format;
        if (this.format === undefined) {
            this.format = function (x) { return x == Infinity ? "" : x.toFixed(0); };
        }
        this.svg.selectAll("text.label").data(d3.range(this.diagram.graph.num_nodes)).enter().append('text').style('font-family', "sans-serif").style('font-size', 0.4 * this.diagram.layout.SCALE + "px").attr('class', "label").attr('text-anchor', "middle").attr('transform', function (id) { return "translate(" + _this.diagram.layout.tile_center(id) + ") translate(0, " + 0.2 * _this.diagram.layout.SCALE + ")"; });
    }
    NumericLabelLayer.prototype.redraw = function (map, ss, id_set) {
        var _this = this;
        this.svg.selectAll("text.label").filter(function (id) { return id_set.has(id); }).text(function (id) {
            var v = map[id][_this.field];
            return v === undefined ? "" : _this.format(v);
        });
    };
    return NumericLabelLayer;
})(DiagramLayer);
var MouseoverLayer = (function (_super) {
    __extends(MouseoverLayer, _super);
    function MouseoverLayer(diagram, set) {
        var _this = this;
        _super.call(this, diagram, 'mouseover');
        this.diagram = diagram;
        this.set = set;
        this.diagram.layer.base.svg.selectAll(".tile").on('mouseover', function (id) { return _this.set_target(id); });
    }
    MouseoverLayer.prototype.set_target = function (id) {
        this.set(id);
        this.diagram.redraw();
    };
    return MouseoverLayer;
})(DiagramLayer);
var ReconstructedPathLayer = (function (_super) {
    __extends(ReconstructedPathLayer, _super);
    function ReconstructedPathLayer(diagram, get, name) {
        if (name === void 0) { name = 'reconstructed_path'; }
        _super.call(this, diagram, name);
        this.diagram = diagram;
        this.get = get;
        this.svg.append('path').attr('class', "path-trace").attr('d', "M 0 0");
    }
    ReconstructedPathLayer.prototype.redraw = function (map, ss) {
        var path = ['M'];
        var id = this.get();
        if (id < 0) {
            path.push(0, 0);
        }
        else {
            path.push(this.diagram.layout.tile_center(id));
            while (map[id].parent !== undefined) {
                id = map[id].parent;
                path.push('L', this.diagram.layout.tile_center(id));
            }
        }
        this.svg.select(".path-trace").attr('d', path.join(" "));
    };
    return ReconstructedPathLayer;
})(DiagramLayer);
var HeuristicLayer = (function (_super) {
    __extends(HeuristicLayer, _super);
    function HeuristicLayer(diagram, get_mouseover, get_goal) {
        _super.call(this, diagram, 'heuristic_distance');
        this.diagram = diagram;
        this.get_mouseover = get_mouseover;
        this.get_goal = get_goal;
        this.svg.append('path').attr('class', "heuristic").attr('d', "M 0 0");
    }
    HeuristicLayer.prototype.redraw = function (map, ss) {
        var layout = this.diagram.layout;
        var d = ['M', 0, 0];
        if (this.get_goal() >= 0 && this.get_mouseover() >= 0) {
            d = [
                'M',
                layout.tile_center(this.get_mouseover()),
                'L',
                layout.tile_center(this.get_goal())
            ];
        }
        this.svg.select(".heuristic").attr('d', d.join(" "));
    };
    return HeuristicLayer;
})(DiagramLayer);
// Draggable markers for start positions. As we're dragging, I use the
// 'target' property to determine which tile we're dragging to.
// Sometimes that target will be a drag marker; I'm going to ignore
// these by only looking for tile targets. It'd be smoother if I
// disabled mouse events on the markers on dragstart and restored them
// on dragend, but then I lose the css cursor on the marker. It'd be
// even smoother if I mapped x,y to grid position directly instead of
// relying on svg for it, but that'd be harder when I want to reuse
// this code for non-grids.
var DraggableMarkerLayer = (function (_super) {
    __extends(DraggableMarkerLayer, _super);
    function DraggableMarkerLayer(diagram, class_name, svg_shape, obj, key) {
        var _this = this;
        _super.call(this, diagram, 'draggable_marker_' + class_name);
        this.diagram = diagram;
        this.obj = obj;
        this.key = key;
        this.drag_handle = this.svg.append('g').attr('class', "draggable");
        this.drag_handle.append('circle').attr('r', this.diagram.layout.SCALE / Math.sqrt(2)).attr('fill', "none");
        this.drag_handle.append('path').attr('class', class_name).attr('d', svg_shape);
        var behavior = d3.behavior.drag().on('dragstart', function (i) { return _this.svg.classed('dragging', true); }).on('dragend', function (i) { return _this.svg.classed('dragging', false); }).on('drag', function (i) {
            var id = _this.currently_pointing_at();
            if (id != -1) {
                _this.obj[_this.key] = id;
                _this.diagram.redraw();
            }
        });
        this.svg.call(behavior);
    }
    DraggableMarkerLayer.prototype.redraw = function (map, ss) {
        var _this = this;
        var id = this.obj[this.key];
        this.drag_handle.attr('transform', function (i) { return "translate(" + _this.diagram.layout.tile_center(id) + ")"; });
    };
    return DraggableMarkerLayer;
})(DiagramLayer);
// Contour lines for any numeric field, for square grids only
var Conrec; // load conrec.js to define this
var ContourLayer = (function (_super) {
    __extends(ContourLayer, _super);
    function ContourLayer(diagram, field) {
        if (field === void 0) { field = 'sort_key'; }
        _super.call(this, diagram, 'contour');
        this.diagram = diagram;
        this.field = field;
        this.sentinelValue = 1e3;
    }
    ContourLayer.prototype.redraw = function (map, ss) {
        var c = new Conrec();
        var graph = this.diagram.graph;
        var layout = this.diagram.layout;
        // Build a 2d array, which the contour library needs; extend it beyond the border with a high value
        var matrix = [];
        var maxLevel = 0;
        for (var x = -1; x <= graph.W; x++) {
            matrix.push([]);
            for (var y = -1; y <= graph.H; y++) {
                var v = this.sentinelValue;
                if (graph.valid(x, y)) {
                    var id = graph.to_id(x, y);
                    v = map[id][this.field];
                    if (v > maxLevel) {
                        maxLevel = v;
                    }
                    if (v === undefined) {
                        v = this.sentinelValue;
                    }
                }
                matrix[x + 1].push(v);
            }
        }
        // Contour lines at 1.5, 2.5, 3.5, etc. It doesn't work well if we are on a integer boundary.
        var levels = [];
        for (var level = 1; level <= maxLevel; level++) {
            levels.push(level + 0.5);
        }
        c.contour(matrix, 0, matrix.length - 1, 0, matrix[0].length - 1, d3.range(-1, matrix.length - 1), d3.range(-1, matrix[0].length - 1), levels.length, levels);
        // Draw the contour lines
        var paths = this.svg.selectAll("path").data(c.contourList());
        var colors = d3.interpolateHsl(d3.hsl("hsl(330, 30%, 30%)"), d3.hsl("hsl(60, 10%, 60%)"));
        paths.exit().remove();
        paths.enter().append('path');
        paths.attr('class', function (d, i) { return "contour contour-" + i; }).attr('stroke', function (d, i) { return colors(Math.pow(i / levels.length, 0.5)); }).attr('d', function (line) { return svg_points_to_path(line.map(function (p) { return layout.xy_scaled([p.x, p.y]); })); });
    };
    return ContourLayer;
})(DiagramLayer);
// Tiles colored with a gradient
var ColoredLabelLayer = (function (_super) {
    __extends(ColoredLabelLayer, _super);
    function ColoredLabelLayer(diagram, field) {
        var _this = this;
        if (field === void 0) { field = 'sort_key'; }
        _super.call(this, diagram, 'colors_' + field);
        this.diagram = diagram;
        this.field = field;
        this.color0 = "hsl(330,50%,50%)";
        this.color1 = "hsl(60,10%,85%)";
        this.exp = 0.7;
        this.svg.selectAll(".tile").data(d3.range(this.diagram.graph.num_nodes)).enter().append('path').attr('class', "tile").attr('transform', function (id) { return "translate(" + _this.diagram.layout.tile_center(id) + ")"; }).attr('fill-opacity', 0.5).attr('d', function (id) { return svg_points_to_path(_this.diagram.layout.tile_shape(id)); });
    }
    ColoredLabelLayer.prototype.redraw = function (map, ss) {
        var _this = this;
        var max = 0;
        for (var id = 0; id < this.diagram.graph.num_nodes; id++) {
            var x = map[id][this.field];
            if (x > max)
                max = x;
        }
        // Now color things appropriately
        var colors = d3.interpolateHsl(d3.hsl(this.color0), d3.hsl(this.color1));
        this.svg.selectAll(".tile").attr('fill', function (id) { return map[id].tile_weight != Infinity && map[id][_this.field] !== undefined ? colors(Math.pow(map[id][_this.field], _this.exp) / Math.pow(max, _this.exp)) : "none"; });
    };
    return ColoredLabelLayer;
})(DiagramLayer);
// From http://www.redblobgames.com/pathfinding/a-star/
// Copyright 2014 Red Blob Games <redblobgames@gmail.com>
// License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
///<reference path="../d.ts/DefinitelyTyped/d3/d3.d.ts" />
///<reference path="../grid.ts" />
///<reference path="../search.ts" />
///<reference path="../diagram.ts" />
"use strict";
console.info("I'm happy to answer questions about the code; email me at redblobgames@gmail.com");
// Yes, numbering these instead of giving them names was a mistake ..
function makeDiagram_top() {
    var graph = new SquareGrid(40, 20);
    var layout = new SquareGridLayout(graph, 15);
    var exit = { id: graph.to_id(38, 10) };
    var options = new SearchOptions([graph.to_id(7, 11)], null, function (id, node) {
        node.h = manhattan_heuristic(graph, exit.id, id);
        return node.cost_so_far + 1.01 * node.h;
    });
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 40, 49, 55, 60, 65, 80, 84, 95, 105, 120, 124, 129, 140, 145, 160, 162, 163, 164, 165, 166, 169, 175, 180, 185, 200, 202, 206, 209, 215, 220, 221, 222, 224, 225, 240, 242, 246, 249, 250, 251, 255, 260, 265, 280, 282, 286, 291, 292, 294, 295, 296, 297, 299, 300, 305, 320, 322, 326, 335, 345, 360, 362, 366, 367, 368, 369, 400, 402, 409, 415, 425, 440, 449, 450, 451, 452, 455, 456, 457, 458, 459, 460, 461, 462, 464, 465, 480, 482, 489, 492, 495, 500, 505, 520, 522, 529, 535, 540, 545, 560, 562, 563, 564, 565, 566, 567, 568, 569, 572, 575, 580, 585, 600, 606, 612, 615, 620, 625, 640, 646, 652, 655, 665, 680, 692, 700, 705, 720, 726, 732, 735, 740, 745, 760, 761, 762, 763, 764, 765, 766, 767, 768, 769, 770, 771, 772, 773, 774, 775, 776, 777, 778, 779, 780, 781, 782, 783, 784, 785, 35, 77, 149, 158, 227, 230, 308, 311, 389, 427, 557, 594, 676].forEach(function (id) { return graph.set_tile_weight(id, Infinity); });
    [26, 27, 29, 30, 31, 32, 36, 37, 38, 39, 66, 67, 70, 71, 72, 75, 76, 78, 79, 106, 107, 108, 109, 112, 113, 116, 117, 118, 119, 146, 147, 148, 150, 153, 156, 157, 159, 186, 187, 188, 189, 190, 191, 196, 197, 198, 199, 226, 228, 229, 231, 232, 235, 236, 237, 238, 239, 266, 267, 268, 269, 270, 271, 272, 276, 277, 278, 279, 306, 307, 309, 310, 312, 316, 317, 318, 319, 346, 347, 348, 349, 350, 351, 352, 356, 357, 388, 390, 391, 426, 428, 429, 466, 467, 468, 506, 507, 546, 586, 626].forEach(function (id) { return graph.set_tile_weight(id, 2); });
    [355, 358, 359, 392, 395, 396, 397, 398, 399, 430, 431, 432, 435, 436, 437, 438, 439, 469, 470, 471, 475, 476, 477, 478, 479, 508, 509, 510, 514, 515, 516, 517, 518, 519, 547, 548, 549, 550, 553, 554, 555, 556, 558, 559, 587, 588, 589, 590, 593, 595, 596, 597, 598, 599, 627, 628, 629, 632, 633, 634, 635, 636, 637, 638, 639, 666, 667, 668, 673, 674, 675, 677, 678, 679, 706, 707, 708, 709, 712, 713, 714, 715, 716, 717, 718, 719, 746, 747, 748, 749, 752, 753, 754, 755, 756, 757, 758, 759, 786, 787, 788, 789, 790, 793, 794, 795, 796, 797, 798, 799].forEach(function (id) { return graph.set_tile_weight(id, 3); });
    [28, 33, 34, 68, 69, 73, 74, 110, 111, 114, 115, 151, 152, 154, 155, 192, 193, 194, 195, 233, 234, 273, 274, 275, 313, 314, 315, 353, 354, 393, 394, 433, 434, 472, 473, 474, 511, 512, 513, 551, 552, 591, 592, 630, 631, 710, 711, 750, 751, 791, 792].forEach(function (id) { return graph.set_tile_weight(id, 20); });
    var diagram = new Diagram("#diagram_top", graph, options, layout, [
        [BaseLayer],
        [GraphEditorLayer, [1, 2, 3, 8, 20, Infinity]],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [DraggableMarkerLayer, 'start', svg_blob(9), options.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(8), exit, 'id']
    ]);
    return diagram;
}
var diagram_top = makeDiagram_top();
var diagram0_walls = [21, 22, 51, 52, 81, 82, 93, 94, 111, 112, 123, 124, 133, 134, 141, 142, 153, 154, 163, 164, 171, 172, 173, 174, 175, 183, 184, 193, 194, 201, 202, 203, 204, 205, 213, 214, 223, 224, 243, 244, 253, 254, 273, 274, 283, 284, 303, 304, 313, 314, 333, 334, 343, 344, 373, 374, 403, 404, 433, 434]; /* ids for a 30x15 grid */
function makeDiagram0() {
    // NOTE: Unfortunately, because of the simplistic way my diagrams
    // work, I can't link these together with a shared graph. I want
    // the first diagram to have an animated slider, which is
    // optimized to draw only changed elements. The second diagram has
    // expensive contour lines, and is not animated. If I share the
    // graph, then the slider will trigger a redraw in the second
    // diagram, and that's rather slow. So I'm just going to ignore
    // the problem for now and not have the diagrams linked.
    var graph_a = new SquareGrid(30, 15);
    var graph_b = new SquareGrid(30, 15);
    // NOTE: to make this list, draw on the graph, then run in console: diagram0.graph.tiles_with_given_weight(Infinity).toString()
    diagram0_walls.forEach(function (id) {
        graph_a.set_tile_weight(id, Infinity);
        graph_b.set_tile_weight(id, Infinity);
    });
    var layout_a = new SquareGridLayout(graph_a, 20);
    var options_a = new SearchOptions([graph_a.to_id(8, 7)]);
    var diagram_a = new Diagram("#diagram0a", graph_a, options_a, layout_a, [
        [BaseLayer],
        [GraphEditorLayer],
        [DraggableMarkerLayer, 'start', svg_blob(11), options_a.starts, 0]
    ]);
    new Slider("#diagram0a", [diagram_a]).set_slider_to(13);
    var layout_b = new SquareGridLayout(graph_b, 20);
    var options_b = new SearchOptions(options_a.starts);
    var diagram_b = new Diagram("#diagram0b", graph_b, options_b, layout_b, [
        [BaseLayer],
        [GraphEditorLayer],
        [ColoredLabelLayer],
        [ContourLayer],
        [DraggableMarkerLayer, 'start', svg_blob(13), options_b.starts, 0]
    ]);
    // NOTE: I made the second blob a little bigger to hide the contour lines underneath it
    return { a: diagram_a, b: diagram_b };
}
var diagram0 = makeDiagram0();
function makeDiagram1() {
    var graph = new SquareGrid(9, 4);
    var layout = new SquareGridLayout(graph, 600 / 9);
    var options = new SearchOptions([graph.to_id(3, 1)]);
    var diagram = new Diagram("#diagram1", graph, options, layout, [
        [BaseLayer],
        [GraphEditorLayer],
        [NumericLabelLayer, 'visit_order'],
        [NeighborsLayer],
        [DraggableMarkerLayer, 'start', svg_blob(20), options.starts, 0]
    ]);
    new Slider("#diagram1", [diagram]);
    d3.select("#diagram1 .step_back").text("< Step backward");
    d3.select("#diagram1 .step_forward").text("Step forward >");
    return diagram;
}
var diagram1 = makeDiagram1();
function makeDiagram2() {
    var graph = new SquareGrid(30, 15);
    var layout = new SquareGridLayout(graph, 20);
    diagram0_walls.forEach(function (id) {
        graph.set_tile_weight(id, Infinity);
    });
    var mouseover = -1;
    var options = new SearchOptions([graph.to_id(8, 7)]);
    var diagram = new Diagram("#diagram2", graph, options, layout, [
        [BaseLayer],
        [GraphEditorLayer],
        [MouseoverLayer, function (id) {
            mouseover = id;
        }],
        [ParentPointerLayer],
        [ReconstructedPathLayer, function () { return mouseover; }],
        [DraggableMarkerLayer, 'start', svg_blob(14), options.starts, 0]
    ]);
    // NOTE: I made the second blob a little bigger to hide the parent pointers underneath it
    return diagram;
}
var diagram2 = makeDiagram2();
function makeDiagram3() {
    var graph = new SquareGrid(15, 15);
    var layout = new SquareGridLayout(graph, 19);
    var exit = { id: graph.to_id(8, 9) };
    var a_options = new SearchOptions([graph.to_id(2, 6)]);
    var a = new Diagram("#diagram-early-exit-false", graph, a_options, layout, [
        [BaseLayer],
        [GraphEditorLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [NumericLabelLayer, 'cost_so_far'],
        [DraggableMarkerLayer, 'start', svg_blob(10), a_options.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(9), exit, 'id']
    ]);
    var b_options = new SearchOptions(a_options.starts, function (ss) { return exit.id == ss.current; });
    var b = new Diagram("#diagram-early-exit-true", graph, b_options, layout, [
        [BaseLayer],
        [GraphEditorLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [NumericLabelLayer, 'cost_so_far'],
        [DraggableMarkerLayer, 'start', svg_blob(10), b_options.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(9), exit, 'id']
    ]);
    a.link_to(b);
    b.link_to(a);
    return { a: a, b: b };
}
var diagram3 = makeDiagram3();
function makeDiagram4() {
    var graph = new SquareGrid(10, 10);
    var layout = new SquareGridLayout(graph, 28);
    var options = new SearchOptions([graph.to_id(1, 4)]);
    var exit = { id: graph.to_id(8, 5) };
    [71, 72, 73, 81, 82, 83].forEach(function (id) { return graph.set_tile_weight(id, Infinity); });
    [14, 15, 24, 25, 26, 34, 35, 36, 37, 43, 44, 45, 46, 47, 53, 54, 55, 56, 57, 64, 65, 66, 74, 75, 76, 84, 85].forEach(function (id) { return graph.set_tile_weight(id, 5); });
    var graph_proxy = graph.make_proxy();
    graph_proxy.edge_weight = function (id1, id2) { return 1; };
    var a = new Diagram("#diagram-weights-false", graph_proxy, options, layout, [
        [BaseLayer],
        [GraphEditorLayer, [1, 5, Infinity]],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [NumericLabelLayer, 'cost_so_far'],
        [DraggableMarkerLayer, 'start', svg_blob(15), options.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(12), exit, 'id']
    ]);
    var b = new Diagram("#diagram-weights-true", graph, options, layout, [
        [BaseLayer],
        [GraphEditorLayer, [1, 5, Infinity]],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [NumericLabelLayer, 'cost_so_far'],
        [DraggableMarkerLayer, 'start', svg_blob(15), options.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(12), exit, 'id'],
    ]);
    a.link_to(b);
    b.link_to(a);
    return { a: a, b: b };
}
var diagram4 = makeDiagram4();
function makeDiagram5() {
    var graph = new SquareGrid(15, 15);
    var layout = new SquareGridLayout(graph, 19);
    var options = new SearchOptions([graph.to_id(2, 8)]);
    var exit = { id: graph.to_id(13, 6) };
    [0, 1, 2, 15, 16, 17, 30, 31, 36, 37, 38, 39, 45, 46, 51, 52, 53, 54, 60, 61, 65, 66, 67, 68, 69, 70, 75, 80, 81, 82, 83, 84, 85, 95, 96, 97, 98, 100, 110, 111, 113, 114, 115, 125, 126, 127, 128, 130, 140, 141, 143, 144, 145, 155, 156, 157, 158, 159, 160, 171, 172, 173, 174, 180, 186, 187, 188, 189, 195, 196, 197, 210, 211, 212, 213].forEach(function (id) { return graph.set_tile_weight(id, 5); });
    var graph_proxy = graph.make_proxy();
    graph_proxy.edge_weight = function (id1, id2) { return 1; };
    var a = new Diagram("#diagram-dijkstra-unweighted", graph_proxy, options, layout, [
        [BaseLayer],
        [GraphEditorLayer, [1, 5, Infinity]],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [ContourLayer],
        [DraggableMarkerLayer, 'start', svg_blob(10), options.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(9), exit, 'id']
    ]);
    var b = new Diagram("#diagram-dijkstra-weighted", graph, options, layout, [
        [BaseLayer],
        [GraphEditorLayer, [1, 5, Infinity]],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [ContourLayer],
        [DraggableMarkerLayer, 'start', svg_blob(10), options.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(9), exit, 'id']
    ]);
    a.link_to(b);
    b.link_to(a);
    new Slider("#diagram-dijkstra", [a, b]).set_slider_to(67);
    return { a: a, b: b };
}
var diagram5 = makeDiagram5();
// I drew this on graph paper by hand and then wrote down the
// coordinates here, then tweaked it a lot. I'm sure there's a better
// way but I'm only making one of these and it didn't take long enough
// that I cared to use better tools.
function makeDiagram6() {
    var graph = new Graph(17);
    graph._center = [];
    graph._paths = [];
    graph.edge_weight = function (id1, id2) {
        var xy1 = this._center[id1], xy2 = this._center[id2];
        var dx = xy1[0] - xy2[0], dy = xy1[1] - xy2[1];
        return Math.sqrt(dx * dx + dy * dy);
    };
    var layout = new GraphLayout(graph, 29);
    function S(xy) {
        return xy.map(function (z) { return z * layout.SCALE; });
    }
    layout.tile_center = function (id) { return S(graph._center[id]); };
    layout.tile_shape = function (id) { return graph._paths[id].map(S); };
    function P(id, neighbors, center, path) {
        graph._center[id] = center;
        graph._paths[id] = path.map(function (p) { return [p[0] - center[0], p[1] - center[1]]; });
        graph._edges[id] = neighbors;
    }
    P(0, [1, 2], [2, 2], [[1, 0], [0, 2], [0, 3], [1, 4], [3.5, 2], [3.5, 1], [3, 0.5]]);
    P(1, [0, 2, 5], [5, 0.75], [[4, 0.5], [3.5, 1], [3.5, 2], [5, 4], [6, 3.5], [6.5, 3], [7, 2], [7, 1], [8, 1], [8, 0.5], [7, 0.5], [7, 0], [5, 0]]);
    P(2, [0, 1, 3], [3.5, 5], [[1, 4], [1, 5], [3, 6], [3, 6.5], [4, 6.5], [4, 6], [5, 5], [5, 4], [3.5, 2]]);
    P(3, [2, 4, 15], [3.5, 8.5], [[3, 6.5], [3, 7], [2.5, 7], [2.5, 10], [5, 10], [5, 9], [6.5, 9], [6.5, 8], [5, 8], [5, 7], [4, 7], [4, 6.5]]);
    P(4, [3], [1, 8.5], [[0, 7], [0, 10], [2.5, 10], [2.5, 7]]);
    P(5, [1, 6], [10, 0.75], [[10, 0], [9, 0.5], [8, 0.5], [8, 1], [9, 1], [8.5, 2], [8.5, 3], [9, 4], [10, 4.5], [11, 4.5], [11, 0]]);
    P(6, [5, 7, 13], [13, 3], [[11, 0], [11, 4.5], [15, 4.5], [15, 0]]);
    P(7, [6, 8], [16, 1.5], [[15, 0], [15, 4.5], [16, 4], [16.5, 3], [16.5, 2], [17, 2], [17, 1], [16.5, 1], [16.5, 0]]);
    P(8, [7, 9], [18, 1.5], [[17, 0], [17, 3], [17.5, 3.5], [20, 1], [20, 0]]);
    P(9, [8, 10], [19.5, 4.5], [[17.5, 3.5], [18, 4], [19, 4], [19, 5], [20, 5], [20, 1]]);
    P(10, [9, 11], [18.75, 6], [[19, 5], [18, 6], [17, 6], [19, 8], [19, 6], [20, 5]]);
    P(11, [10, 12], [17.5, 7.5], [[17, 6], [17, 7], [16.5, 7], [16.5, 8], [17, 8], [17, 9], [19, 9], [19, 8]]);
    P(12, [11, 13, 14], [15, 7.5], [[14, 7], [14, 10], [16, 10], [16, 8], [16.5, 8], [16.5, 7], [16, 7], [16, 6], [15.5, 5.5]]);
    P(13, [6, 16, 15, 14, 12], [13, 6], [[12, 4.5], [12, 5], [11, 5], [11, 6.5], [12, 7], [14, 7], [15.5, 5.5], [15, 5], [14, 5], [14, 4.5]]);
    P(14, [12, 13, 15], [13, 8], [[12, 7], [12, 10], [14, 10], [14, 7]]);
    P(15, [14, 13, 16, 3], [9, 8.5], [[6.5, 8], [6.5, 9], [8, 9], [8, 10], [12, 10], [12, 7], [11, 6.5], [8, 8]]);
    P(16, [13, 15], [9.5, 6], [[9, 5], [8, 6], [8, 8], [11, 6.5], [11, 5]]);
    var options = new SearchOptions([0]);
    var exit = { id: 11 };
    var diagram = new Diagram("#diagram-nongrid", graph, options, layout, [
        [BaseLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [ParentPointerLayer],
        [NumericLabelLayer, 'cost_so_far', function (x) { return x.toFixed(1); }],
        [DraggableMarkerLayer, 'start', svg_blob(15), options.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(13), exit, 'id']
    ]);
    return diagram;
}
var diagram6 = makeDiagram6();
function manhattan_heuristic(graph, goal, current) {
    var xy0 = graph.from_id(goal);
    var xy1 = graph.from_id(current);
    return Math.abs(xy0[0] - xy1[0]) + Math.abs(xy0[1] - xy1[1]);
}
function makeDiagram_7_8(parent_selector, walls) {
    var graph = new SquareGrid(15, 15);
    var layout = new SquareGridLayout(graph, 19);
    var exit = { id: graph.to_id(14, 2) };
    walls.forEach(function (id) { return graph.set_tile_weight(id, Infinity); });
    var options_a = new SearchOptions([graph.to_id(0, 12)], function (ss) { return ss.current == exit.id; });
    var diagram_a = new Diagram(parent_selector + " .left", graph, options_a, layout, [
        [BaseLayer],
        [GraphEditorLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [DraggableMarkerLayer, 'start', svg_blob(10), options_a.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(9), exit, 'id']
    ]);
    var options_b = new SearchOptions(options_a.starts, options_a.exit_now, function (id, node) {
        node.h = manhattan_heuristic(graph, exit.id, id);
        return node.h;
    });
    options_b.allow_reprioritize = false;
    var diagram_b = new Diagram(parent_selector + " .right", graph, options_b, layout, [
        [BaseLayer],
        [GraphEditorLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [DraggableMarkerLayer, 'start', svg_blob(10), options_b.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(9), exit, 'id']
    ]);
    diagram_a.link_to(diagram_b);
    diagram_b.link_to(diagram_a);
    new Slider(parent_selector, [diagram_a, diagram_b]);
    return { a: diagram_a, b: diagram_b };
}
var diagram7 = makeDiagram_7_8("#diagram-greedybestfirst", []);
var diagram8 = makeDiagram_7_8("#diagram-greedybestfirst-complex", [32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 57, 72, 87, 102, 117, 132, 147, 162, 177, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192]);
function makeDiagram9() {
    var graph = new SquareGrid(15, 15);
    var layout = new SquareGridLayout(graph, 19);
    var exit = { id: graph.to_id(14, 1) };
    var mouseover = -1;
    [35, 36, 37, 38, 39, 40, 41, 42, 57, 72, 87, 102, 117, 132, 147, 162, 177, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192].forEach(function (id) { return graph.set_tile_weight(id, Infinity); });
    var options_a = new SearchOptions([graph.to_id(0, 12)], function (ss) { return ss.current == exit.id; });
    var diagram_a = new Diagram("#diagram-astar-1", graph, options_a, layout, [
        [BaseLayer],
        [GraphEditorLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [NumericLabelLayer, 'cost_so_far'],
        [MouseoverLayer, function (id) {
            mouseover = id;
        }],
        [ReconstructedPathLayer, function () { return mouseover; }, 'cost_so_far'],
        [DraggableMarkerLayer, 'start', svg_blob(8), options_a.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(7), exit, 'id']
    ]);
    var options_b = new SearchOptions(options_a.starts, options_a.exit_now, function (id, node) {
        node.h = manhattan_heuristic(graph, exit.id, id);
        return node.h;
    });
    options_b.allow_reprioritize = false;
    var diagram_b = new Diagram("#diagram-astar-2", graph, options_b, layout, [
        [BaseLayer],
        [GraphEditorLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [NumericLabelLayer, 'h'],
        [MouseoverLayer, function (id) {
            mouseover = id;
        }],
        [HeuristicLayer, function () { return mouseover; }, function () { return exit.id; }],
        [DraggableMarkerLayer, 'start', svg_blob(8), options_b.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(7), exit, 'id']
    ]);
    var options_c = new SearchOptions(options_a.starts, options_a.exit_now, function (id, node) {
        node.h = manhattan_heuristic(graph, exit.id, id);
        return node.cost_so_far + 1.01 * node.h;
    });
    var layout_c = new SquareGridLayout(graph, 35);
    var diagram_c = new Diagram("#diagram-astar-3", graph, options_c, layout_c, [
        [BaseLayer],
        [GraphEditorLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [NumericLabelLayer, 'sort_key'],
        [MouseoverLayer, function (id) {
            mouseover = id;
        }],
        [ReconstructedPathLayer, function () { return mouseover; }, 'cost_so_far'],
        [HeuristicLayer, function () { return mouseover; }, function () { return exit.id; }],
        [DraggableMarkerLayer, 'start', svg_blob(16), options_c.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(15), exit, 'id']
    ]);
    diagram_a.link_to(diagram_b);
    diagram_a.link_to(diagram_c);
    diagram_b.link_to(diagram_a);
    diagram_b.link_to(diagram_c);
    diagram_c.link_to(diagram_a);
    diagram_c.link_to(diagram_b);
    return { a: diagram_a, b: diagram_b, c: diagram_c };
}
var diagram9 = makeDiagram9();
function makeDiagram10() {
    var graph = new SquareGrid(15, 15);
    var layout = new SquareGridLayout(graph, 19);
    var exit = { id: graph.to_id(10, 9) };
    var options_a = new SearchOptions([graph.to_id(4, 5)]);
    var diagram_a = new Diagram("#diagram-contour-comparison .left", graph, options_a, layout, [
        [BaseLayer],
        [GraphEditorLayer],
        [ColoredLabelLayer],
        [ContourLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [DraggableMarkerLayer, 'start', svg_blob(10), options_a.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(7), exit, 'id']
    ]);
    var options_b = new SearchOptions(options_a.starts, options_a.exit_now, function (id, node) {
        node.h = manhattan_heuristic(graph, exit.id, id);
        return node.h;
    });
    options_b.allow_reprioritize = false;
    var diagram_b = new Diagram("#diagram-contour-comparison .right", graph, options_b, layout, [
        [BaseLayer],
        [GraphEditorLayer],
        [ColoredLabelLayer],
        [ContourLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [DraggableMarkerLayer, 'start', svg_blob(10), options_b.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(7), exit, 'id']
    ]);
    var options_c = new SearchOptions(options_a.starts, options_a.exit_now, function (id, node) {
        node.h = manhattan_heuristic(graph, exit.id, id);
        return node.cost_so_far + 1.01 * node.h;
    });
    var layout_c = new SquareGridLayout(graph, 35);
    var diagram_c = new Diagram("#diagram-contour-comparison .combined", graph, options_c, layout_c, [
        [BaseLayer],
        [GraphEditorLayer],
        [ColoredLabelLayer],
        [ContourLayer],
        [ReconstructedPathLayer, function () { return exit.id; }],
        [DraggableMarkerLayer, 'start', svg_blob(16), options_c.starts, 0],
        [DraggableMarkerLayer, 'goal', svg_cross(15), exit, 'id']
    ]);
    diagram_a.link_to(diagram_b);
    diagram_a.link_to(diagram_c);
    diagram_b.link_to(diagram_a);
    diagram_b.link_to(diagram_c);
    diagram_c.link_to(diagram_a);
    diagram_c.link_to(diagram_b);
    return { a: diagram_a, b: diagram_b, c: diagram_c };
}
var diagram10 = makeDiagram10();
// Code highlighting for http://www.redblobgames.com/
// Copyright 2014 Red Blob Games
// License: Apache v2
// I don't want to syntax highlight; instead, I want to highlight
// specific words to match up with diagrams. This code surrounds given
// words X by <span class="X">X</span>
"use strict";
// Take plain text (from a <pre> section) and a set of words, and turn
// the text into html with those words marked. This code is for my own
// use and assumes that the words are \w+ with no spaces or
// punctuation etc.
function highlight_words(text, words) {
    var pattern = new RegExp("\\b(" + words.join("|") + ")\\b", 'g');
    return text.replace(pattern, "<span class='$&'>$&</span>");
}
function test_highlight_words() {
    function T(a, b) {
        if (a != b) {
            console.log("ASSERT failed:");
            console.log("   A = ", a);
            console.log("   B = ", b);
        }
    }
    T(highlight_words("begin end", ['begin', 'end']), "<span class='begin'>begin</span> <span class='end'>end</span>");
    T(highlight_words("begin middle funcall() end", ['middle', 'funcall']), "begin <span class='middle'>middle</span> <span class='funcall'>funcall</span>() end");
    T(highlight_words("begin eol\nbol end", ['eol', 'bol']), "begin <span class='eol'>eol</span>\n<span class='bol'>bol</span> end");
    T(highlight_words("begin object.method end", ['object', 'method']), "begin <span class='object'>object</span>.<span class='method'>method</span> end");
}
test_highlight_words();
