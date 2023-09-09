import fetch from 'node-fetch'
import fs from 'node:fs/promises'
import path from 'node:path'

const urls = {
	kat: {
		url: 'https://liwsa.com/webapps/spappz_live/schedule_maint',
		postData:
			'reg_year=2024&flt_area=cfc&season=All&division=o30&agegroup=All&team_refno=24&stype=All&sname=All&sstat=All&fieldref=All&fdate=9%2F8%2F2023&tdate=2%2F11%2F2024&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=liwsa&returnto=&firsttime=0',
	},
	mo: {
		url: 'https://liwsa.com/webapps/spappz_live/schedule_maint',
		postData:
			'reg_year=2024&flt_area=sffc&season=All&division=premier&agegroup=All&team_refno=38&stype=All&sname=All&sstat=All&fieldref=All&fdate=9%2F9%2F2023&tdate=2%2F11%2F2024&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=liwsa&returnto=&firsttime=0',
	},
	nad: {
		url: 'https://visl.org/webapps/spappz_live/schedule_maint',
		postData:
			'reg_year=2024&flt_area=cas&season=All&division=3&sched_pool=All&team_refno=All&stype=All&sname=All&sstat=All&fieldref=All&fdate=9%2F8%2F2023&tdate=3%2F2%2F2024&dow=All&start_time=All&sortby1=sched_time&sortby2=sched_type&sortby3=sched_name&sortby4=None&cmd=Excel&appid=visl&returnto=&firsttime=0',
	},
}

async function downloadSchedule(person) {
	const params = new URLSearchParams(urls[person].postData)
	const responsePromise = fetch(urls[person].url, {
		method: 'POST',
		body: params,
	})
	const filename = path.join('data', `${person}.csv`)
	const handlePromise = fs.open(filename, 'w')

	const [response, handle] = await Promise.all([
		responsePromise,
		handlePromise,
	])

	const fileData = await response.text()
	await handle.write(fileData)
	await handle.close()

	console.log(`Downloaded ${filename}`)
}

async function writeFetchDate() {
	const fetchDate = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'full',
		timeStyle: 'short',
	}).format(new Date())
	await fs.writeFile(path.join('data', 'fetch-date'), fetchDate)

	console.log(`Wrote fetchDate: ${fetchDate}`)
}

try {
	downloadSchedule('mo')
	downloadSchedule('nad')
	downloadSchedule('kat')
	writeFetchDate()
} catch (e) {
	console.error(e)
}
