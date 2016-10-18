var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var fs = require("fs");
var _ = require('underscore');
var Random = require('random-js');

function main()
{
	var args = process.argv.slice(2);

	if( args.length == 0 )
	{
		//args = ["subject.js"];
		args = ["./calc.js"];
	}
	var filePath = args[0];

	constraints(filePath);

	generateTestCases()

}

var engine = Random.engines.mt19937().autoSeed();

function createConcreteIntegerValue( greaterThan, constraintValue )
{
	if( greaterThan )
		return Random.integer(constraintValue,constraintValue+10)(engine);
	else
		return Random.integer(constraintValue-10,constraintValue)(engine);
}

function Constraint(properties)
{
	this.ident = properties.ident;
	this.op = properties.op;
	this.expression = properties.expression;
	this.operator = properties.operator;
	this.value = properties.value;
	this.alt = properties.alt;
	this.funcName = properties.funcName;
	this.varName = properties.varName;
	// Supported kinds: "fileWithContent","fileExists"
	// integer, string, phoneNumber
	this.kind = properties.kind;
}

var functionConstraints =
{
}

function generateTestCases()
{
	var content = "var subject = require('./calc.js')\n";
	for ( var funcName in functionConstraints )
	{
		var params = {};
		// initialize params
		for (var i =0; i < functionConstraints[funcName].params.length; i++ )
		{
			if(functionConstraints[funcName].constraints.length > 0)
			{
				var paramName = functionConstraints[funcName].constraints[i].op.trim();
				if(paramName == "'^'")
				{
					var varName = functionConstraints[funcName].constraints[i].varName;
					var exp = "'3^2'";
					content += "subject.{0}[{1}]({2});\n".format(varName, paramName, exp);
				}
				else if(paramName == "'|'")
				{
					var varName = functionConstraints[funcName].constraints[i].varName;
					var exp = "'3|2'";
					content += "subject.{0}[{1}]({2});\n".format(varName, paramName, exp);
				}
				else if(paramName == "'!'")
				{
					var varName = functionConstraints[funcName].constraints[i].varName;
					var exp = "'3!'";
					content += "subject.{0}[{1}]({2});\n".format(varName, paramName, exp);
				}
			}
		}
	}
	fs.writeFileSync('./test.js', content, "utf8");
}

function cartesianProduct(a) { // a = array of array
    var i, j, l, m, a1, o = [];
		var temp = [];
    if (!a || a.length == 0) return a;

    a1 = a.splice(0, 1)[0]; // the first array of a

    a = cartesianProduct(a);
    for (i = 0, l = a1.length; i < l; i++) {
        if (a && a.length) for (j = 0, m = a.length; j < m; j++)
            o.push([a1[i]].concat(a[j]));
        else
            o.push([a1[i]]);
    }
    return o;
}

function constraints(filePath)
{
   var buf = fs.readFileSync(filePath, "utf8");
	var result = esprima.parse(buf, options);

	traverse(result, function (node)
	{
		var alt;
		var funcName;
		if (node.type === 'VariableDeclaration')
		{
			var name = varName(node);
			if(node.declarations[0].type === 'VariableDeclarator' && node.declarations[0].init.type === 'ObjectExpression'){
				var properties = node.declarations[0].init.properties;
				properties.forEach(function (property){
					traverse(property, function(childNode){
						if(childNode.key && childNode.key.type && childNode.key.type === 'Literal'){
							var op = childNode.key.raw;
							if(childNode.value.type === 'FunctionExpression'){
								funcName = functionName(childNode.value);
								console.log("Line : {0} Function: {1}".format(node.loc.start.line, funcName ));

								var params = childNode.value.params.map(function(p) {return p.name});
								functionConstraints[funcName] = {constraints:[], params: params};
								if(childNode.value.body.type === 'BlockStatement'){
									var bodies = childNode.value.body.body;
									bodies.forEach(function(body){
										if(body.type === 'IfStatement' && body.test.operator == "==="){
											if( body.test.left.type == 'Identifier')
											{
												// get expression from original source code:
												var expression = buf.substring(body.test.range[0], body.test.range[1]);
												var rightHand = buf.substring(body.test.right.range[0], body.test.right.range[1]);
												rightHand = (parseInt(rightHand));
												functionConstraints[funcName].constraints.push(
													new Constraint(
													{
														varName: name,
														op: op,
														ident: body.test.left.name,
														value: rightHand,
														alt: rightHand + 1,
														funcName: funcName,
														kind: "integer",
														operator : body.test.operator,
														expression: expression
													}));
											}
										}

										if(body.type === 'IfStatement' && body.test.operator == "!=="){
											if( body.test.left.type == 'CallExpression')
											{
												// get expression from original source code:
												var expression = buf.substring(body.test.range[0], body.test.range[1]);
												var rightHand = buf.substring(body.test.right.range[0], body.test.right.range[1]);
												functionConstraints[funcName].constraints.push(
													new Constraint(
													{
														varName: name,
														op: op,
														ident: body.test.left.name,
														value: rightHand,
														alt: '"random"',
														funcName: funcName,
														kind: "integer",
														operator : body.test.operator,
														expression: expression
													}));
											}
										}
									})
								}

							}
						}
						});
				});
			}
		}
	});
	console.log( "%j", functionConstraints);
}


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

function varName( node ){
	if(node.declarations[0].id)
	{
		return node.declarations[0].id.name;
	}
	return "";
}

function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "";
}


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

main();
