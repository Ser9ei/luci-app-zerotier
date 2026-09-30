/* SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2026 Ser9ei
 * Inspired by service control code in luci-app-pbr by @stangri.
*/

'use strict';
'require poll';
'require rpc';
'require ui';
'require baseclass';

const callGetInitStatus = rpc.declare({
	object: 'luci.zerotier',
	method: 'getInitStatus',
	expect: { '': {} }
});

const callSetInitAction = rpc.declare({
	object: 'luci.zerotier',
	method: 'setInitAction',
	params: [ 'action' ],
	expect: { '': {} }
});

const callGetVersion = rpc.declare({
	object: 'luci.zerotier',
	method: 'getVersion',
	expect: { '': {} }
});

var status = baseclass.extend({
	getServiceStatus() {
		return callGetInitStatus().then(function(res) {
			const st = res?.zerotier || {};
			return {
				running: st.running === true,
				enabled: st.enabled === true,
				configEnabled: st.config_enabled === true,
				node: st.node || ''
			};
		});
	},

	renderStatus(running, enabled, configEnabled) {
		const status = running ? _('Running') : _('Stopped');
		const autostart = enabled ? _('Enabled') : _('Disabled');
		let text = `${status} (${autostart})`;

		if (!configEnabled)
			text += ` - ${_('Disabled in Global configuration')}`;

		return E('span', {}, text);
	},

	pollServiceStatus(expectRunning, callback) {
		const maxAttempts = 15;
		let attempt = 0;
		const self = this;

		function checkStatus() {
			attempt++;
			self.getServiceStatus().then(function(status) {
				const isRunning = status.running === true;
				if (expectRunning ? isRunning : !isRunning) {
					callback(true);
				}
				else if (attempt >= maxAttempts) {
					callback(false, 'timeout');
				}
				else {
					setTimeout(checkStatus, 1000);
				}
			}).catch(function() {
				if (attempt < maxAttempts)
					setTimeout(checkStatus, 1000);
				else
					callback(false, 'error');
			});
		}

		setTimeout(checkStatus, 1500);
	},

	render() {
		const self = this;
		const header = E('div', {}, [
			E('h2', { class: 'content' }, 'ZeroTier'),
			E('div', { class: 'cbi-map-descr' }, [
				_('ZeroTier is an open source, cross-platform and easy to use virtual LAN.'),
				' ',
				_('For further information, see'),
				' ',
				E('a', {
					target: '_blank',
					rel: 'noopener noreferrer',
					href: 'https://openwrt.org/docs/guide-user/services/vpn/zerotier'
				}, _('OpenWrt ZeroTier documentation.'))
			])
		]);

		const version = E('div', { class: 'cbi-value' }, [
			E('label', { class: 'cbi-value-title' }, _('Version')),
			E('div', { class: 'cbi-value-field' }, _('Collecting data…'))
		]);

		const status = E('div', { class: 'cbi-value' }, [
			E('label', { class: 'cbi-value-title' }, _('Service Status')),
			E('div', { class: 'cbi-value-field' }, _('Collecting data…'))
		]);

		const node = E('div', { class: 'cbi-value' }, [
			E('label', { class: 'cbi-value-title' }, _('Node Status')),
			E('div', { class: 'cbi-value-field' }, _('Collecting data…'))
		]);

		const central = E('div', { class: 'cbi-value' }, [
			E('label', { class: 'cbi-value-title' }, 'ZeroTier Central'),
			E('div', { class: 'cbi-value-field' }, [
				E('button', {
					class: 'btn cbi-button cbi-button-apply',
					type: 'button',
					click: function() {
						window.open('https://my.zerotier.com/network', '_blank', 'noopener,noreferrer');
					}
				}, _('Open website')),
				E('div', { class: 'cbi-value-description' }, [
					_('Create or manage your ZeroTier network and authorize clients.'),
					' ',
					E('a', {
						target: '_blank',
						rel: 'noopener noreferrer',
						href: 'https://docs.zerotier.com/quickstart/'
					}, _('See documentation')),
					'.'
				])
			])
		]);

		function performServiceAction(action, expectedRunning, message) {
			ui.showModal(null, [
				E('p', { class: 'spinning' }, message)
			]);

			return callSetInitAction(action)
				.then(function() {
					self.pollServiceStatus(expectedRunning, function() {
						ui.hideModal();
						self.getServiceStatus().then(updateStatus);
					});
				})
				.catch(function(err) {
					ui.hideModal();
					ui.addNotification(null,
						E('p', {},
							_('Failed to perform the requested service action: %s')
								.format(err.message)
						),
						'error'
					);
					self.getServiceStatus().then(updateStatus);
				});
		}

		function setServiceAutostart(action, message) {
			ui.showModal(null, [
				E('p', { class: 'spinning' }, message)
			]);
			return callSetInitAction(action)
				.then(function() {
					return self.getServiceStatus().then(updateStatus);
				})
				.catch(function(err) {
					ui.addNotification(null,
						E('p', {},
							_('Failed to perform the requested service action: %s')
								.format(err.message)
						),
						'error'
					);
					return self.getServiceStatus().then(updateStatus);
				})
				.finally(function() {
					ui.hideModal();
				});
		}

		const btnStart = E('button', {
			class: 'btn cbi-button cbi-button-apply',
			disabled: true,
			type: 'button',
			click: function() {
				return performServiceAction(
					'start',
					true,
					_('Starting ZeroTier service')
				);
			}
		}, _('Start'));

		const btnRestart = E('button', {
			class: 'btn cbi-button cbi-button-apply',
			disabled: true,
			type: 'button',
			click: function() {
				return performServiceAction(
					'restart',
					true,
					_('Restarting ZeroTier service')
				);
			}
		}, _('Restart'));

		const btnStop = E('button', {
			class: 'btn cbi-button cbi-button-reset',
			disabled: true,
			type: 'button',
			click: function() {
				return performServiceAction(
					'stop',
					false,
					_('Stopping ZeroTier service')
				);
			}
		}, _('Stop'));

		const btnEnable = E('button', {
			class: 'btn cbi-button cbi-button-apply',
			disabled: true,
			type: 'button',
			click: function() {
				return setServiceAutostart(
					'enable',
					_('Enabling ZeroTier service')
				);
			}
		}, _('Enable'));

		const btnDisable = E('button', {
			class: 'btn cbi-button cbi-button-reset',
			disabled: true,
			type: 'button',
			click: function() {
				return setServiceAutostart(
					'disable',
					_('Disabling ZeroTier service')
				);
			}
		}, _('Disable'));

		const btnGap = E('span', {}, '\u00a0\u00a0');
		const btnGapLong = E('span', {}, '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0');
		const buttonsTitle = E('label', {
			class: 'cbi-value-title'
		}, _('Service Control'));

		const buttonsField = E('div', { class: 'cbi-value-field' }, [
			btnStart,
			btnGap,
			btnRestart,
			btnGap,
			btnStop,
			btnGapLong,
			btnEnable,
			btnGap,
			btnDisable
		]);

		const buttonsRow = E('div', {
			class: 'cbi-value'
		}, [
			buttonsTitle,
			buttonsField
		]);

		function updateStatus(res) {
			res = res || {};

			const running = res.running === true;
			const enabled = res.enabled === true;
			const configEnabled = res.configEnabled === true;
			const nodeInfo = res.node || '';

			status.lastElementChild.replaceChildren(
				self.renderStatus(running, enabled, configEnabled)
			);
			node.lastElementChild.textContent = nodeInfo || '-';

			btnStart.disabled = running || !configEnabled;
			btnRestart.disabled = !running || !configEnabled;
			btnStop.disabled = !running;
			btnEnable.disabled = enabled && configEnabled;
			btnDisable.disabled = !enabled || !configEnabled;

			document.dispatchEvent(new CustomEvent('zerotier-status-updated'));
		}

		callGetVersion()
			.then(function(res) {
				const ver = res?.zerotier;
				if (!ver)
					return version.lastElementChild.textContent = _('Unknown');

				version.lastElementChild.replaceChildren(
					E('div', {}, [
						E('div', {}, ('ZeroTier One - %s').format(ver.version || _('Unknown'))),
						E('div', {}, [
							_('LuCI app project - %s').format(ver.luci || _('Unknown')),
							' (',
							E('a', {
								target: '_blank',
								rel: 'noopener noreferrer',
								href: 'https://github.com/Ser9ei/luci-app-zerotier'
							}, 'GitHub'),
							')'
						])
					])
				);
			})
			.catch(function() {
				version.lastElementChild.textContent = _('Unknown');
			});

		this.getServiceStatus().then(updateStatus);

		poll.add(function() {
			return self.getServiceStatus().then(updateStatus);
		});

		return E('div', {}, [
			header,
			version,
			status,
			node,
			central,
			buttonsRow
		]);
	}
});

return L.Class.extend({
	status: status
});
