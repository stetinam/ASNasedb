
config?=config-ljocha.yaml

yamls=$(shell ls *.j2 | sed 's/\.j2//')

install: 
	for y in ${yamls}; do jinja2 $$y.j2 ${config} >$$y; done
	kubectl apply ${shell for f in ${yamls}; do echo -f $$f; done }

ns=${shell yq .namespace ${config}}

uninstall:
	-kubectl -n ${ns} delete deployment.apps/nginx 
	-kubectl -n ${ns} delete deployment.apps/aspdb-api 
	-kubectl -n ${ns} delete ingress.networking.k8s.io/nginx 
	-kubectl -n ${ns} delete service/nginx
	-kubectl -n ${ns} delete service/aspdb-api

# be safe
#kubectl -n ${ns} delete persistentvolumeclaim/asparaginase-seq-database
#kubectl -n ${ns} delete persistentvolumeclaim/html-content


