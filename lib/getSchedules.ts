import { kv } from '@vercel/kv'
import fetch from 'node-fetch'
import { parse } from 'csv-parse/sync'
import { orderBy } from 'lodash'
import { getVsscSchedule } from './getVsscSchedule'
import { waitUntil } from '@vercel/functions'

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
		who: who,
		field: field_name,
		home: home_team,
		away: visit_team,
	}
}

async function getSpAppzSchedule(
	person: keyof typeof fetchers,
	{ url, postData }: { url: string; postData: string }
) {
	const params = new URLSearchParams(postData)
	const response = await fetch(url, {
		method: 'POST',
		body: params,
	})

	const csvText = await response.text()
	const csvRows = parse(csvText as string, { columns: true })

	const csvRowsWithWho = csvRows.map((gameRow: GameData[]) => ({
		...gameRow,
		who: person,
	}))
	const games: Game[] = csvRowsWithWho.map(gameFactory)

	return games
}

const fetchers = {
	kat: () =>
		getSpAppzSchedule('kat', {
			url: 'https://liwsa.com/webapps/spappz_live/schedule_maint',
			postData:
				'reg_year=2025&flt_area=cfc&season=All&division=o30&agegroup=All&team_refno=24&stype=All&sname=All&sstat=All&fieldref=All&fdate=All&tdate=All&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=liwsa&returnto=&firsttime=0',
		}),
	mo: () =>
		getSpAppzSchedule('mo', {
			url: 'https://liwsa.com/webapps/spappz_live/schedule_maint',
			postData:
				'reg_year=2025&flt_area=sffc&season=All&division=tiereddiv&agegroup=All&team_refno=38&stype=All&sname=All&sstat=All&fieldref=All&fdate=All&tdate=All&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=liwsa&returnto=&firsttime=0',
		}),
	tash: () =>
		getSpAppzSchedule('tash', {
			url: 'https://liwsa.com/webapps/spappz_live/schedule_maint',
			postData:
				'reg_year=2025&flt_area=sffc&season=All&division=tiereddiv&agegroup=All&team_refno=57&stype=All&sname=All&sstat=All&fieldref=All&fdate=All&tdate=All&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=liwsa&returnto=&firsttime=0',
		}),
	nad: () =>
		getSpAppzSchedule('nad', {
			url: 'https://visl.org/webapps/spappz_live/schedule_maint',
			postData:
				'reg_year=2025&flt_area=cas&season=All&division=2&sched_pool=All&team_refno=All&stype=All&sname=All&sstat=All&fieldref=All&fdate=All&tdate=&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=visl&returnto=&firsttime=0',
		}),
	owls: () =>
		getVsscSchedule(
			'https://vssc.leaguelab.com/league/76780/schedule',
			'THE OWLS'
		).then((games) => games.map((game) => ({ ...game, who: 'owls' }))),
	'green-machine': () =>
		getVsscSchedule(
			'https://vssc.leaguelab.com/league/76778/schedule',
			'Green Machine'
		).then((games) =>
			games.map((game) => ({ ...game, who: 'green-machine' }))
		),
}

async function downloadSchedule(person: keyof typeof fetchers) {
	const games = await fetchers[person]()

	waitUntil(kv.set(`socker-schedules:${person}`, games))

	console.log(`Saved schedule for ${person}`)

	return games
}

async function writeFetchDate() {
	const fetchDate = new Date().toISOString()
	kv.set('socker-schedules:fetch-date', fetchDate)

	console.log(`Saved fetchDate: ${fetchDate}`)

	return fetchDate
}

export async function downloadSchedules() {
	const schedulesPromise = Promise.all(
		Object.keys(fetchers).map(downloadSchedule)
	)
	const [schedules, fetchDate] = await Promise.all([
		schedulesPromise,
		writeFetchDate(),
	])

	let games = schedules.flat()

	games = orderBy(games, 'date')

	return {
		games,
		fetchDate,
	}
}
