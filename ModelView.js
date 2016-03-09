var jmv = window.jmv = {};

jmv.ModelView = function($context, $computations) {
    $computations = $computations || {};

    var self = this;
    self.subscribers = [];
    self.namedSubscribers = {};
    self.observables = {};
    self.views = {};

    self.registerView = function(key, view) {
        view = view instanceof jmv.View ? view : new jmv.View(view);
        if (!self.observables[key]) {
            self.observables[key] = jmv.observables($context, $computations, key);
        }
        if (!self.views[key]) {
            self.views[key] = [];
            registerObserver(key); 
        }
        self.views[key].push(view);
        bindListener(key, view);
        return self;
    };

    self.subscribe = function(key, subscriber) {
        if (!subscriber) {
            subscriber = key;
            key = null;
        }

        if (key) {
            if (!self.namedSubscribers[key]) {
                self.namedSubscribers[key] = [];
            }
            self.namedSubscribers[key].push(subscriber);
        } else {
            self.subscribers.push(subscriber);
        }
        return self;
    };

    self.updateAllViews = function(key) {
        if (!key) {
            jmv.utils.each(self.observables, function(computed, key) {
                self.updateAllViews(key);
            });
        } else {
            jmv.utils.each(self.views[key], function(view) {
                view.update(self.observables[key]);
            });
        }

        return self;
    };

    function registerObserver(key) {
        self.observables[key].registerObserver(onChange);
    }

    function onChange(observable) {
        jmv.utils.each(self.views[key], function(view) {
            view.update(computed, self.changedElement);
        });
    }

    function bindListener(key, view) {
        jmv.utils.each(view.elements, function(element) {
            if (!jmv.utils.isInputElement(element)) return;

            var eventName = "change";
            element.addEventListener(eventName, function(evt) {
                self.changedElement = element;
                self.observables[key].compute(jmv.utils.elementValue(element));
                notifyChanges(key);
            });
        });
    }

    function notifyChanges(key) {
        if (!key) {
            jmv.utils.each(self.observables, function(observable, key) {
                self.observables[key].notifyObservers();
            });
        } else {
            self.observables[key].notifyObservers();
            notifySubscribers(key);
        }
        notifySubscribers();
    }

    function notifySubscribers(key) {
        if (!key) {
            jmv.utils.each(self.subscribers, function(subscriber) {
                subscriber.bind(self)($context);
            });
        } else {
            jmv.utils.each(self.namedSubscribers[key], function(subscriber) {
                subscriber.bind(self)($context);
            });
        }
    }
};

jmv.View = function(elements) {
    var self = this;
    self.elements = typeof elements === "string" ? document.querySelectorAll(elements)
        : elements instanceof jQuery ? elements.toArray()
        : elements instanceof HTMLElement ? [elements]
        : elements;

    self.update = function(observable, changedElement) {
        jmv.utils.each(self.elements, function(element) {
            if (element != changedElement) {
                jmv.utils.elementValue(element, observable.compute());
            }
        });
    };
};

jmv.computed = function($context, $computations, key) {
    var self = {};
    self.observers = [];

    var computation = $computations[key] = $computations[key] || {};
    computation.parser = computation.parser || function(value) {
        return value;
    };
    computation.formatter = computation.formatter || function(value) {
        return value;
    };

    self.computed = function(value) {
        if (value === undefined) {
            return $context[key];
        } else {
            $context[key] = value;
            return self;
        }
    };

    self.computed.compute = function(value) {
        if (value === undefined) {
            // formatter is the function that formats model's value for the view to show
            return computation.formatter($context[key]);
        } else {
            // parser is the function that parse value from the view for the model to store
            $context[key] = computation.parser(value);
            return self;
        }
    };

    self.computed.isObservable = true;

    self.computed.notifyObservers = function() {
        jmv.utils.each(self.observers, function(observer) {
            observer(self.computed);
        });
    };

    self.computed.registerObserver = function(observer) {
        self.observers.push(observer);
    };

    return self.computed;
};

jmv.utils = {};

jmv.utils.each = function(collection, callback) {
    for (var key in collection) {
        if (collection.hasOwnProperty(key)) {
            if (callback(collection[key], key) === false) {
                break;
            }
        }
    }
};

jmv.utils.elementValue = function(element, value) {
    var key;
    if (jmv.utils.isInputElement(element)) {
        switch (element.type.toLowerCase()) {
            case "checkbox":
                key = "checked";
                break;
            case "textarea":
                key = "innerHTML";
                break;
            default:
                key = "value";
                break;
        }
    } else {
        switch (element.tagName.toLowerCase()) {
            case "img":
                key = "src";
                break;
            default:
                key = "innerHTML";
                break;
        }
    }

    if (key == "src") {
        console.log(element, value);
    }

    if (value) element[key] = value;
    else return element[key];
};

jmv.utils.isInputElement = function(element) {
    return jmv.utils.checkElement(element, { tagName: ['input', 'select', 'textarea'] });
};

jmv.utils.checkElement = function(element, criteria) {
    if (element.nodeType != 1) return false;
    if (typeof criteria === "string") criteria = [ criteria ];
    if (criteria instanceof Array) criteria = { tagName: criteria };

    var valid = true;
    jmv.utils.each(criteria, function(array, attr) {
        if (typeof array === "string") array = [ array ];
        valid = false;
        jmv.utils.each(array, function(value) {
            if (element[attr].toLowerCase() === value.toLowerCase()) {
                valid = true;
                return false;
            }
        });
        return valid;
    });

    return valid;
};
