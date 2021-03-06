<?php

// incldue dom parser
require('./vendor/shark/simple_html_dom/simple_html_dom.php');

// via https://gist.github.com/jakebellacera/635416

// Variables used in this script:
//   $summary     - text title of the event
//   $datestart   - the starting date (in seconds since unix epoch)
//   $dateend     - the ending date (in seconds since unix epoch)
//   $address     - the event's address
//   $uri         - the URL of the event (add http://)
//   $description - text description of the event
//   $filename    - the name of this file for saving (e.g. my-event-name.ics)
//
// Notes:
//  - the UID should be unique to the event, so in this case I'm just using
//    uniqid to create a uid, but you could do whatever you'd like.
//
//  - iCal requires a date format of "yyyymmddThhiissZ". The "T" and "Z"
//    characters are not placeholders, just plain ol' characters. The "T"
//    character acts as a delimeter between the date (yyyymmdd) and the time
//    (hhiiss), and the "Z" states that the date is in UTC time. Note that if
//    you don't want to use UTC time, you must prepend your date-time values
//    with a TZID property. See RFC 5545 section 3.3.5
//
//  - The Content-Disposition: attachment; header tells the browser to save/open
//    the file. The filename param sets the name of the file, so you could set
//    it as "my-event-name.ics" or something similar.
//
//  - Read up on RFC 5545, the iCalendar specification. There is a lot of helpful
//    info in there, such as formatting rules. There are also many more options
//    to set, including alarms, invitees, busy status, etc.
//
//      https://www.ietf.org/rfc/rfc5545.txt

// 1. Set the correct headers for this file
if ($_GET['debug'] !== "true") {
    header('Content-type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename=' . $filename);
}


// 2. Define helper functions

// Converts a unix timestamp to an ics-friendly format
// NOTE: "Z" means that this timestamp is a UTC timestamp. If you need
// to set a locale, remove the "\Z" and modify DTEND, DTSTAMP and DTSTART
// with TZID properties (see RFC 5545 section 3.3.5 for info)
//
// Also note that we are using "H" instead of "g" because iCalendar's Time format
// requires 24-hour time (see RFC 5545 section 3.3.12 for info).
function dateToCal($timestamp) {
  return date('Ymd', $timestamp);
}

function dateToCalDateTime($timestamp) {
  return date('Ymd\THis\Z', $timestamp);
}

function addTimeZoneOffset($time) {
  $timeInInt = (int) $time;
  $timeInInt = $timeInInt + 200;
  if ($timeInInt < 1000) {
    return '0'.$timeInInt;
  } else {
    return $timeInInt;
  }
}

// Escapes a string of characters
function escapeString($string) {
  return preg_replace('/([\,;])/','\\\$1', $string);
}

$username = strip_tags($_GET['name']);

if(empty($username)) {
    var_dump('error, no name provided (append "?name=your-profilename" to the url');
    exit();
}

$events = '';

$html = file_get_html('https://www.residentadvisor.net/profile/'.$username);
foreach($html->find('ul#items .event-item') as $element) {
    $datestart = $element->find('div.bbox h1', 0)->plaintext;
    $datestart = substr($datestart, 0, -3); // remove trailing slash

    $url = 'https://www.residentadvisor.net'.$element->find('a', 0)->href;
    $timeDetails = file_get_html($url)->find('#detail ul li', 0)->plaintext;
    $timeDetailsExploded = preg_split('/\r\n|\r|\n/', $timeDetails);
    $startHour = '00:00'; $endHour = '00:00';
    if (count($timeDetailsExploded) == 3) {
        $hourDetails = $timeDetailsExploded[2];
        $startHour = explode(" - ", $hourDetails)[0];
        $endHour = substr(explode(" - ", $hourDetails)[1], 0, -5); // remove trailing </li>
    } else {
        //$datestart = $timeDetailsExploded
        $hourDetails = $timeDetailsExploded[1];
        $startHour = explode(" - ", $hourDetails)[0];
        $endHour = substr(explode(" - ", $hourDetails)[1], 0, -5); // remove trailing </li>
    }
    
    $startHour = str_replace(":", "", $startHour ?: '00:00');
    $endHour = str_replace(":", "", $endHour ?: '00:00');

    $title = explode("</a>", $element->find('div.bbox h1.title a span.title', 0)->plaintext, 2)[0]; //remove </a> and whatever is trailing

    $address = explode("</h1>", $element->find('div.bbox h1.title', 0)->find('span', 1)->plaintext, 2)[0]; // remove </h1> and whatever is trailing
    $address = substr($address, 8); // remove prefix '</a> at '

    $events .= parseEvent(strtotime($datestart), strtotime($datestart), $startHour, $endHour, $url, $title.'<br>'.$url.'<br>'.$address, $address, $title, $hourDetails);
}

function parseEvent($datestart, $dateend, $startHour, $endHour, $uri, $description, $address, $summary, $hourDetails) {
    $str = 'BEGIN:VEVENT
HOURDETAILS:'.$hourDetails.'START:'.$startHour.'END:'.$endHour.'
DTEND:'.dateToCal($dateend).'T'.addTimeZoneOffset($endHour).'00Z
UID:'.uniqid().'
DTSTAMP:'.dateToCalDateTime(time()).'
LOCATION:'.escapeString($address).'
DESCRIPTION:'.escapeString($description).'
URL;VALUE=URI:'.escapeString($uri).'
SUMMARY:'.escapeString($summary).'
DTSTART:'.dateToCal($datestart).'T'.addTimeZoneOffset($startHour).'00Z
END:VEVENT
';

// SUMMARY:'.escapeString($summary).'
    return $str;
}

$events = preg_replace('~\R~u', "\r\n", $events);

// 3. Echo out the ics file's contents
?>
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//RESIDENTADVISOR//RemoteApi//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:RA <?= escapeString($username) ?>

<?= $events ?>
END:VCALENDAR
