<?php
define('app','av');
require_once('modules/dev/dev.php');
class av
{
	private static $vv;
	public static function setup()
	{
		if ( self::$vv ) { return; }
		$vv=&self::$vv;
		$vv = array();
		$vv['title'] = 'PHP Eval'; 
		$vv['descr'] = 'Evaluete PHP code on local server'; 
		$vv['file'] = basename(__FILE__);
		$vv['editor_initial_content']
=<<<'NOWDOC'
//https://www.w3schools.com/jsref/tryit.asp?filename=tryjsref_node_insertbefore
// Create a "li" element:
const newNode = document.createElement("li");
// Create a text node:
const textNode = document.createTextNode("Water");
// Append text node to "li" element:
newNode.appendChild(textNode);

// Insert before existing child:
const list = document.getElementById("myList");
list.insertBefore(newNode, list.children[0]);
NOWDOC;
	}
	//
	public static function get($a_key)
	{
		$vv=&self::$vv;
		if ( isset($vv[$a_key]) )
		{
			return $vv[$a_key];
		}
		else
		{
			dev::epre('Key not found: '.$a_key);
			exit;
		}
	}
	
	public static function evaluate()
	{
		$vv=&self::$vv;
		ob_start();
			eval($_POST['code']);
		$output = ob_get_contents();
		ob_end_clean();
		return $output;
	}
}
av::setup();

if ( isset($_POST['code']) )
{
	$result=av::evaluate();
	$prevcode=$_POST['code'];
}
else
{
	$prevcode=false;
	$result='';
}

?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="content-type" content="text/html; charset=UTF-8">
		<meta charset="UTF-8">
		<title><?=av::get('title');?></title>
		<style>
			.blockw a {color:black; text-decoration:none;}
			.blockw {display: block;	position: relative;	width: 90%;
			height: max-content;padding: 1rem;margin: 1rem auto; 
			text-align: center;color: black;} .weco{ min-height:7rem; }
			.result{text-align: left; min-height:7rem; border: 1px solid grey; }
		</style>
	</head>
	<body>
		<main>
			<h1 class="blockw"><a href=""><?=av::get('title');?></a></h1>
			<form action="<?=av::get('file');?>" method="post" id="form_id">
				<div data-form="form_id" id="code" name="code" class="weco render-php "><?php if($prevcode){echo $prevcode;}?></div>
			    <input type="submit" name="name0" id="name0" value="Submit" class="blockw" onclick="weco.submit('code');">
			</form>
			<textarea id="result" name="result" class="blockw result"><?=$result;?></textarea>
		</main>
		<script src="weco/weco.js"> </script>
	</body>
</html>
