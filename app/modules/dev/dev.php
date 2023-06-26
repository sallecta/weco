<?php if(!defined('app')){ die('you cannot load this page directly.'); } ?>
<?php

if(!defined('dev')){ define('dev',true); }
class dev
{
	private static function out($a_msg,$a_bt)
	{
		$line=$a_bt[0]['line'];
		$file=basename($a_bt[0]['file']);
		$out='<pre>'.$file.': '.$line;
		$out=$out.': '.json_encode($a_msg);
		$out=$out.'</pre>';
		return $out;
	}
	
	public static function rpre($a_msg=Null)
	{
		if( !dev ){ return; }
		return self::out( $a_msg,debug_backtrace() );
	}
	public static function epre($a_msg=Null)
	{
		if( !dev ){ return; }
		printf (self::out( $a_msg, debug_backtrace()) );
	}
}
