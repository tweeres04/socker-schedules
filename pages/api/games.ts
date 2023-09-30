import { downloadSchedules } from '../../lib/getSchedules'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	const { fetchDate, games } = await downloadSchedules()
	res.json({ games, fetchDate })
}
