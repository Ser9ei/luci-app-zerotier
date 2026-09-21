/* SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2022 ImmortalWrt.org
 * Copyright (C) 2026 Ser9ei
 */

'use strict';
'require rpc';
'require ui';
'require view';

function formatBytes(bytes) {
	if (bytes === null || bytes === undefined || bytes === '')
		return '0 B';

	const value = Number(bytes);

	if (!Number.isFinite(value))
		return '0 B';

	const units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB' ];
	let unit = 0;
	let size = value;

	while (size >= 1024 && unit < units.length - 1) {
		size /= 1024;
		unit++;
	}

	return unit === 0
		? `${Math.round(size)} B`
		: `${size.toFixed(1)} ${units[unit]}`;
}

const callGetInterfaces = rpc.declare({
	object: 'luci.zerotier',
	method: 'getInterfaces',
	expect: { '': {} }
});

return view.extend({
	load() {
		return callGetInterfaces().then(function(res) {
			res = res || {};

			const zerotier = res.zerotier || {};
			const interfaces = zerotier.interfaces || [];

			return Array.isArray(interfaces) ? interfaces : [];
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Unable to get interface info: %s.').format(err.message)));
			return [];
		});
	},

	render_interface: function(interfaceData, index, isLast) {
		const fields = [
			[_('Network Name'), interfaceData.name],
			[_('Network ID'), interfaceData.network_id],
			[_('Network Device'), interfaceData.device_name],
			[_('Type'), interfaceData.type],
			[_('Status'), interfaceData.status],
			[_('MAC Address'), interfaceData.mac],
			[_('IP Address'), interfaceData.ip_address],
			[_('MTU'), interfaceData.mtu],
			[_('Received'), formatBytes(interfaceData.rx_bytes)],
			[_('Sent'), formatBytes(interfaceData.tx_bytes)]
		];

		const rows = fields.map(function(field) {
			return E('tr', {class: 'tr'}, [
				E('td', {class: 'td left', 'width': '25%'}, field[0]),
				E('td', {class: 'td left', 'width': '25%'}, field[1])
			]);
		});

		if (!isLast) {
			rows.push(E('tr', { class: 'tr' }, [E('td', {class: 'td', colspan: '2'}, '')]));
		}

		return E('table', {
			class: 'table',
			style: index > 0 ? 'margin-top: 1em' : null
		}, rows);
	},

	render(data) {
		const title = E('h2', {class: 'content'}, _('ZeroTier'));
		const desc = E('div', {class: 'cbi-map-descr'},
			[_('ZeroTier is an open source, cross-platform and easy to use virtual LAN'),
			' (',
			E('a', {
				target: '_blank',
				rel: 'noopener noreferrer',
				href: 'https://openwrt.org/docs/guide-user/services/vpn/zerotier'
			}, _('OpenWrt ZeroTier documentation')),
			').'
		]);

		if (!Array.isArray(data) || data.length === 0) {
			return E('div', {}, [title, desc, E('div', {}, _('No interface online.'))]);
		}

		const tables = data.map(function(interfaceData, index) {
			return this.render_interface(interfaceData, index, index === data.length - 1);
		}, this);

		return E('div', {}, [title,desc,E('div', {class: 'cbi-section'}, [E('h3', {}, _('Network Interface Information')), ...tables])]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
