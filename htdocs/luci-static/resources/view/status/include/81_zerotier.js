/* SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2026 Ser9ei
 *
*/

'use strict';
'require baseclass';
'require zerotier.status as zt';

return baseclass.extend({
	title: 'ZeroTier',

	load() {
		return new zt.status().getServiceStatus();
	},

	render(data) {
		try {
			const st = data || {};
			const nodeInfo = st.node || '-';
			const networksInfo = st.networks || '-';

			let serviceStatus = st.running ? _('Active') : _('Inactive');
			if (st.running && (!st.configEnabled || !st.enabled))
				serviceStatus += ' (' + _('Disabled') + ')';

			return E('table', {
				'class': 'table',
				'id': 'zerotier_status_table'
			}, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Service Status')),
					E('th', { 'class': 'th' }, _('Node')),
					E('th', { 'class': 'th' }, _('Networks'))
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, serviceStatus),
					E('td', { 'class': 'td' }, nodeInfo),
					E('td', { 'class': 'td' }, networksInfo)
				])
			]);
		}
		catch (e) {
			return E('div', { 'class': 'alert-message warning' },
				_('Unable to retrieve ZeroTier status'));
		}
	}
});
