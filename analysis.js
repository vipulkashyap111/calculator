var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var fs = require("fs");

function parseArgs()
{
    var args = process.argv.slice(2);

    if( args.length == 0 )
    {
        console.log("Please provide the file to analyse!")
    }
    var filePath = args[0];
    
    analyse(filePath);

    // Report
    for( var node in builders )
    {
        var builder = builders[node];
        builder.report();
    }

}

var builders = {};

// Represent a reusable "class" following the Builder pattern.
function ComplexityBuilder()
{
    this.StartLine = 0;
    this.FunctionName = "";
    this.MaxConditions = 0;

    this.report = function()
    {
        console.log(
           (
            "{0}(): {1}\n" +
            "============\n" +
                "MaxConditions: {2}\n\n"
            )
            .format(this.FunctionName, this.StartLine, this.MaxConditions)
        );
    }
};

// A function following the Visitor pattern. Provide current node to visit and function that is evaluated at each node.
function traverse(object, visitor) 
{
    var key, child;

    visitor.call(null, object);

    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor);
            }
        }
    }
}

// A function following the Visitor pattern.
// Annotates nodes with parent objects.
function traverseWithParents(object, visitor)
{
    var key, child;

    visitor.call(null, object);

    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null && key != 'parent') 
            {
                child.parent = object;
                    traverseWithParents(child, visitor);
            }
        }
    }
}


// A function following the Visitor pattern but allows canceling transversal if visitor returns false.
function traverseWithCancel(object, visitor)
{
    var key, child;

    if( visitor.call(null, object) )
    {
        for (key in object) {
            if (object.hasOwnProperty(key)) {
                child = object[key];
                if (typeof child === 'object' && child !== null) {
                    traverseWithCancel(child, visitor);
                }
            }
        }
     }
}

function analyse(filePath)
{
    var buf = fs.readFileSync(filePath, "utf8");
    var ast = esprima.parse(buf, options);

    var i = 0;
    // Tranverse program with a function visitor.
    traverseWithParents(ast, function (node) 
    {
        if (node.type == 'FunctionDeclaration') 
        {
            var builder = new ComplexityBuilder();

            // Function Name
            builder.FunctionName = functionName(node);

            // Max Conditions
            traverseWithParents(node, function(child){
                if(child.type == 'IfStatement') {
                    var builder = new ComplexityBuilder();
                    builder.MaxConditions = countConditions(node);
                }
            });

            builders[builder.FunctionName] = builder;
        }
    });

}

// Helper Function for Counting Conditions inside an IF Statement
function countConditions(node){
    if (node.type != 'LogicalExpression')
        return 1;

    var left = node.test.left;
    var right = node.test.right;

    var leftConditions = countConditions(left);
    var rightConditions = countConditions(right);

    return 1 + leftConditions + rightConditions;
}


// Helper function for printing out function name.
function functionName( node )
{
    if( node.id )
    {
        return node.id.name;
    }
    return "anon function @" + node.loc.start.line;
}

// Helper function for allowing parameterized formatting of strings.
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

parseArgs();