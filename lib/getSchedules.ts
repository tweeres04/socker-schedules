import { kv } from '@vercel/kv'
import fetch from 'node-fetch'
import { capitalize } from 'lodash'
import { parse } from 'csv-parse/sync'
import { orderBy } from 'lodash'

export interface Game {
	date: string
	who: string
	field: string
	home: string
	away: string
}

interface GameData {
	Date: string
	Time: string
	division_name: string
	field_name: string
	home_team: string
	visit_team: string
	who: string
}

function cleanDate(date: string) {
	return date.replace('  ', ' ')
}

function gameFactory({
	Date: date,
	Time,
	field_name,
	home_team,
	visit_team,
	who,
}: GameData): Game {
	return {
		date: cleanDate(`${date} ${Time}`),
		who: capitalize(who),
		field: field_name,
		home: home_team,
		away: visit_team,
	}
}

const urls = {
	kat: {
		url: 'https://liwsa.com/webapps/spappz_live/schedule_maint',
		postData:
			'reg_year=2025&flt_area=cfc&season=All&division=o30&agegroup=All&team_refno=24&stype=All&sname=All&sstat=All&fieldref=All&fdate=All&tdate=All&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=liwsa&returnto=&firsttime=0',
	},
	mo: {
		url: 'https://liwsa.com/webapps/spappz_live/schedule_maint',
		postData:
			'reg_year=2025&flt_area=sffc&season=All&division=tiereddiv&agegroup=All&team_refno=38&stype=All&sname=All&sstat=All&fieldref=All&fdate=All&tdate=All&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=liwsa&returnto=&firsttime=0',
	},
	tash: {
		url: 'https://liwsa.com/webapps/spappz_live/schedule_maint',
		postData:
			'reg_year=2025&flt_area=sffc&season=All&division=tiereddiv&agegroup=All&team_refno=57&stype=All&sname=All&sstat=All&fieldref=All&fdate=All&tdate=All&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=liwsa&returnto=&firsttime=0',
	},
	nad: {
		url: 'https://visl.org/webapps/spappz_live/schedule_maint',
		postData:
			'reg_year=2025&flt_area=cas&season=All&division=2&sched_pool=All&team_refno=All&stype=All&sname=All&sstat=All&fieldref=All&fdate=All&tdate=&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=visl&returnto=&firsttime=0',
	},
}

async function downloadSchedule(person: keyof typeof urls) {
	const params = new URLSearchParams(urls[person].postData)
	const response = await fetch(urls[person].url, {
		method: 'POST',
		body: params,
	})

	const data = await response.text()

	kv.set(`socker-schedules:${person}`, data)

	console.log(`Saved schedule for ${person}`)

	return data
}

async function writeFetchDate() {
	const fetchDate = new Date().toISOString()
	kv.set('socker-schedules:fetch-date', fetchDate)

	console.log(`Saved fetchDate: ${fetchDate}`)

	return fetchDate
}

type Person = 'nad' | 'mo' | 'kat' | 'tash'

async function csvStringsToGames(
	personToCsvStringFn: (person: Person) => Promise<string | null>
) {
	const people: Person[] = ['nad', 'mo', 'kat', 'tash']
	const peopleWithCsvString = await Promise.all(
		people.map(async (person) => ({
			who: person,
			csvString: await personToCsvStringFn(person),
		}))
	)

	const gameData = peopleWithCsvString.reduce<GameData[]>(
		(result, { who, csvString }) => [
			...result,
			...parse(csvString as string, { columns: true }).map(
				(gameRow: GameData[]) => ({
					...gameRow,
					who,
				})
			),
		],
		[]
	)

	let games = gameData.map(gameFactory)
	games = orderBy(games, 'date')

	return games
}

export async function downloadSchedules() {
	const [mo, nad, kat, tash, fetchDate] = await Promise.all([
		downloadSchedule('mo'),
		downloadSchedule('nad'),
		downloadSchedule('kat'),
		downloadSchedule('tash'),
		writeFetchDate(),
	])

	const scheduleHash: Record<Person, string> = {
		mo,
		nad,
		kat,
		tash,
	}

	const games = await csvStringsToGames((person) =>
		Promise.resolve(scheduleHash[person])
	)

	return {
		games,
		fetchDate,
	}
}

export async function getSchedulesFromDatabase() {
	const games = await csvStringsToGames((person: string) =>
		kv.get<string>(`socker-schedules:${person}`)
	)

	const fetchDate = await kv.get<string>(`socker-schedules:fetch-date`)

	return {
		games,
		fetchDate,
	}
}
