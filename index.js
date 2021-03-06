"use strict";

const fetch = require("node-fetch");
const cheerio = require("cheerio");

const _fetchRaEventTimes = async (eventId) => {
    try {
        const response = await fetch('https://www.residentadvisor.net/events/' + eventId);
        const html = await response.text();
        return html;
    } catch (err) {
        console.log(err);
    }
};

const _fetchRaProfilePage = async (name) => {
    try {
        const response = await fetch('https://www.residentadvisor.net/profile/' + name);
        const html = await response.text();
        return html;
    } catch (error) {
        console.log(error);
    }
};

const getEventTimes = (eventPage) => {
    try {
        const $ = cheerio.load(eventPage);
        const eventDateDetails = $('aside#detail ul li:nth-child(1)');
        const date = eventDateDetails.find('a').text();
        const eventDateDetailsArray = eventDateDetails.contents().toArray();
        const time = eventDateDetailsArray[eventDateDetailsArray.length - 1].text();
        console.log('Event date details: ' + JSON.stringify(date) + '. Event time details: ' + JSON.stringify(time));

        // @TODO: convert to ISO-8601
        return date + time;
    } catch (err) {
        console.log(err);
        return {};
    }
};

const getAttendingEvents = async (profilePage) => {
    const $ = cheerio.load(profilePage);
    const elements = $('ul#items article.event-item');
    const events = await Promise.all(elements.toArray().map(async (element) => {
        try {
            const datestart = $(element).find('div.bbox h1').text().slice(-3);
            const href = $(element).find('a').attr('href');
            const eventId = href.split('/')[2];

            const eventPage = await _fetchRaEventTimes(eventId);
            const timeDetails = getEventTimes(eventPage);

            const url = 'https://www.residentadvisor.net' + href;
            return {
                datestart, url, timeDetails
            };
        } catch (err) {
            console.log(err);
            return null;
        }
    }));

    return {events: events.filter(e => !!e)};
};

const createCalendar = (attEvents) => {
    return 'TEST:' + JSON.stringify(attEvents.events);
};

const _getResAdvCalendar = async (name) => {

    let profilePage = await _fetchRaProfilePage(name);
    let attendingEvents = await getAttendingEvents(profilePage);

    let calendar = createCalendar(attendingEvents);

    return calendar;
};

const respond = async (req, res) => {
    let name = req.query.name;
    if (!name) {
        res.status(400).send('Please add ?name=<ra_profile> to the request path.');
    }

    await getResAdvCalendar(name, res);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=' + req.query.name);
    res.end(calendar);
};

exports.getResAdvCalendar = _getResAdvCalendar;
exports.fetchRaEventTimes = _fetchRaEventTimes;

/*
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
*/

