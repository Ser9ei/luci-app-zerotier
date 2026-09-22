/* SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2022 ImmortalWrt.org
 * Copyright (C) 2026 Ser9ei
*/

'use strict';
'require form';
'require rpc';
'require ui';
'require poll';
'require view';
'require tools.widgets as widgets';
'require zerotier.status as zt';

const callGetInterfaces = rpc.declare({
	object: 'luci.zerotier',
	method: 'getInterfaces',
	expect: { '': {} }
});

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

function validateAbsolutePath(section_id, value) {
	if (!value)
		return true;

	if (!value.startsWith('/'))
		return _('Path must be absolute (start with /)');

	if (value.includes('..') || value.includes('//'))
		return _('Invalid path');

	return true;
}

function setSaveActionsVisible(show) {
	document.querySelectorAll('.cbi-page-actions').forEach(function(el) {
		el.style.display = show ? '' : 'none';
	});
}

return view.extend({
	load() {
		return callGetInterfaces().then(function(res) {
			res = res || {};
			const zerotier = res.zerotier || {};
			const interfaces = zerotier.interfaces || [];
			return Array.isArray(interfaces) ? interfaces : [];
		}).catch(function(err) {
			ui.addNotification(null, E('p', {},
				_('Unable to get interface info: %s.').format(err.message)));
			return [];
		});
	},

	render_interface(interfaceData, index, isLast) {
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
			return E('tr', { class: 'tr' }, [
				E('td', { class: 'td left', width: '25%' }, field[0]),
				E('td', { class: 'td left', width: '25%' }, field[1])
			]);
		});

		if (!isLast) {
			rows.push(E('tr', { class: 'tr' }, [
				E('td', { class: 'td', colspan: '2' }, '')
			]));
		}

		return E('table', {
			class: 'table',
			style: index > 0 ? 'margin-top: 1em' : null
		}, rows);
	},

	renderInterfaces(data) {
		if (!Array.isArray(data) || data.length === 0)
			return E('div', {}, _('No interface online.'));

		const tables = data.map(function(interfaceData, index) {
			return this.render_interface(interfaceData, index, index === data.length - 1);
		}, this);

		return E('div', {}, [
			E('h3', {}, _('Network Interface Information')),
			...tables
		]);
	},

	refreshInterfaces() {
		const container = document.getElementById('zerotier-interfaces');
		if (!container)
			return Promise.resolve();

		/* вкладка скрыта — не трогаем */
		if (container.offsetParent === null)
			return Promise.resolve();

		return callGetInterfaces().then(L.bind(function(res) {
			res = res || {};
			const list = res.zerotier?.interfaces;
			const data = Array.isArray(list) ? list : [];
			const content = this.renderInterfaces(data);
			container.replaceChildren(content);
		}, this)).catch(function() {
			/* тихо игнорируем ошибки poll */
		});
	},

	render(data) {
		const status = new zt.status();
		const self = this;
		const m = new form.Map('zerotier');
		let s, o;

		s = m.section(form.NamedSection, 'global', 'zerotier', _('Global configuration'));

		o = s.option(form.Value, 'port', _('Listen port'));
		o.datatype = 'port';

		o = s.option(form.Value, 'secret', _('Client secret'));
		o.password = true;

		o = s.option(form.Value, 'local_conf_path', _('Local config path'),
			_('Path of the optional file local.conf ' +
				'(see <a target="_blank" rel="noopener noreferrer" ' +
				'href="https://docs.zerotier.com/config/#local-configuration-options">' +
				_('documentation') +
				'</a>).'));
		o.value('/etc/zerotier.conf');
		o.validate = validateAbsolutePath;

		o = s.option(form.Value, 'config_path', _('Config path'),
			_('Persistent configuration directory (to keep other configurations such as controller or moons, etc.).'));
		o.value('/etc/zerotier');
		o.validate = validateAbsolutePath;

		o = s.option(form.Flag, 'copy_config_path', _('Copy config path'),
			_('Copy the contents of the persistent configuration directory to memory instead of linking it, this avoids writing to flash.'));
		o.depends({ 'config_path': '', '!reverse': true });

		o = s.option(form.Flag, 'fw_allow_input', _('Allow input traffic'),
			_('Allow input traffic to the ZeroTier daemon.'));

		o = s.option(form.Button, '_panel', _('ZeroTier Central'),
			_('Create or manage your ZeroTier network and authorize clients.'));
		o.inputtitle = _('Open website');
		o.inputstyle = 'apply';
		o.onclick = function() {
			window.open('https://my.zerotier.com/network', '_blank', 'noopener,noreferrer');
		};

		s = m.section(form.GridSection, 'network', _('Network configuration'));
		s.modaltitle = function(section_id) {
			return section_id ? _('Network - %s').format(section_id) : _('New Network');
		};
		s.addremove = true;
		s.rowcolors = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Value, 'id', _('Network ID'), _('16 hexadecimal characters.'));
		o.rmempty = false;
		o.width = '20%';
		o.maxlength = 16;
		o.validate = function(section_id, value) {
			if (!/^[0-9a-fA-F]{16}$/.test(value))
				return _('Must be exactly 16 hexadecimal characters.');
			return true;
		};

		o = s.option(form.Flag, 'allow_managed', _('Allow managed IP/route'),
			_('Allow ZeroTier to set IP addresses and routes (local/private ranges only).'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Flag, 'allow_global', _('Allow global IP/route'),
			_('Allow ZeroTier to set global/public/non-private IP addresses and routes.'));
		o.editable = true;

		o = s.option(form.Flag, 'allow_default', _('Allow default route'),
			_('Allow ZeroTier to set the default route on the system.'));
		o.editable = true;

		o = s.option(form.Flag, 'allow_dns', _('Allow DNS'),
			_('Allow ZeroTier to set DNS servers.'));
		o.editable = true;

		o = s.option(form.Flag, 'fw_allow_input', _('Allow input'),
			_('Allow input traffic from the ZeroTier network.'));
		o.editable = true;

		o = s.option(form.Flag, 'fw_allow_forward', _('Allow forward'),
			_('Allow forward traffic from/to the ZeroTier network.'));
		o.editable = true;

		o = s.option(widgets.DeviceSelect, 'fw_forward_ifaces', _('Forward interfaces'),
			_('Leave empty for all.'));
		o.multiple = true;
		o.noaliases = true;
		o.depends('fw_allow_forward', '1');
		o.modalonly = true;

		o = s.option(form.Flag, 'fw_allow_masq', _('Masquerading'),
			_('Enable network address and port translation (NAT) for outbound traffic for this network.'));
		o.editable = true;

		o = s.option(widgets.DeviceSelect, 'fw_masq_ifaces', _('Masquerade interfaces'),
			_('Leave empty for all.'));
		o.multiple = true;
		o.noaliases = true;
		o.depends('fw_allow_masq', '1');
		o.modalonly = true;

		const tabConfig = E('li', { 'class': 'cbi-tab', 'data-tab': 'config' },
			E('a', { href: '#' }, _('Configuration')));
		const tabInterfaces = E('li', { 'class': 'cbi-tab-disabled', 'data-tab': 'interfaces' },
			E('a', { href: '#' }, _('Interfaces')));
		const tabMenu = E('ul', { 'class': 'cbi-tabmenu' }, [ tabConfig, tabInterfaces ]);

		const panelConfig = E('div', {
			'data-tab': 'config',
			'data-tab-active': 'true'
		});
		const panelInterfaces = E('div', {
			'id': 'zerotier-interfaces',
			'data-tab': 'interfaces',
			'data-tab-active': 'false',
			'style': 'display:none'
		}, [ this.renderInterfaces(data) ]);

		function switchTab(name) {
			const isConfig = (name === 'config');

			tabConfig.className = isConfig ? 'cbi-tab' : 'cbi-tab-disabled';
			tabInterfaces.className = isConfig ? 'cbi-tab-disabled' : 'cbi-tab';

			panelConfig.setAttribute('data-tab-active', isConfig ? 'true' : 'false');
			panelInterfaces.setAttribute('data-tab-active', isConfig ? 'false' : 'true');
			panelConfig.style.display = isConfig ? '' : 'none';
			panelInterfaces.style.display = isConfig ? 'none' : '';

			setSaveActionsVisible(isConfig);

			if (!isConfig)
				self.refreshInterfaces();
		}

		tabConfig.addEventListener('click', function(ev) {
			ev.preventDefault();
			switchTab('config');
		});

		tabInterfaces.addEventListener('click', function(ev) {
			ev.preventDefault();
			switchTab('interfaces');
		});

		return Promise.all([
			status.render(),
			m.render()
		]).then(function(nodes) {
			panelConfig.appendChild(nodes[1]);

			requestAnimationFrame(function() {
				setSaveActionsVisible(true);
			});

			document.addEventListener('zerotier-status-updated', function() {
				self.refreshInterfaces();
			});

			poll.add(function() {
				return self.refreshInterfaces();
			}, 15);

			return E('div', {}, [
				nodes[0],
				tabMenu,
				panelConfig,
				panelInterfaces
			]);
		});
	}
});
