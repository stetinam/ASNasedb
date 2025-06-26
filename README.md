

# Asparaginase Database

## Install instructions

### Prepare API image
1. Go to `api/`
1. Edit `Makefile`, provide the right name for the docker image
1. run `make build push` 

### Deploy at the first time

1. Go to `config/`
1. Choose the right configuration file `config/config-SOMETHING.yaml` or create yours 
1. run `make install config=YOUR-CONFIG.yaml`
1. copy `index.html search.html blast.html` to the `nginx` pod
```
kubectl get pods
...
nginx=nginx-85745bd4cd-n9wzs # example, fill the value returned by kubectl
for f in index.html search.html blast.html; do kubectl cp $f $nginx:/usr/share/nginx/html/; done
```
5. copy database files to the api container
```
api=aspdb-api-fb8469d64-hnh5v  # example only
for f in esp.fasta  swissprot.fasta  uniref100_fam_all.fasta; do kubectl cp $f $api:/blast; done
```
6. initialize blast databases
```
kubectl exec -ti $api -- bash
cd /blast
for f in *.fasta; do b=$(basename $f .fasta); makeblastdb -in $f -dbtype prot -out $b; done
```    
The server should be ready for use now.

### Undeploy

1. go to `config/`
1. run `make uninstall config=YOUR-CONFIG.yaml`

### Deploy next time

The same as first time without the need to copy in the data and initialize databases -- the data volumes are not 
removed by `uninstall`.
